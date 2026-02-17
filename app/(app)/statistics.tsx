import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Platform,
    StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import {
    format,
    startOfMonth,
    endOfMonth,
    subMonths,
    addMonths,
    addDays,
    parseISO,
    startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { calculateDuration, calculateEarnings } from '@/utils/calculations';
import { BonusSettings, defaultBonusSettings, loadBonusSettings } from '@/services/bonusSettings';
import { useTheme } from '@/hooks/useTheme';
import { loadHolidayDateSet } from '@/services/holidays';

type Shift = {
    date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    extra_payment: number;
    break?: number | null;
};

type CalculatedStatistics = {
    baseEarnings: number;
    totalHours: number;
    shiftCount: number;
    averagePerShift: number;
    reliabilityBonus: number;
    anyAvailabilityBonus: number;
    fullTimeAvailabilityBonus: number;
    totalWithBonuses: number;
    bestWeekdayLabel: string;
    worstWeekdayLabel: string;
};

type MonthComparison = {
    current: { earnings: number; hours: number; shifts: number; bonuses: number };
    previous: { earnings: number; hours: number; shifts: number; bonuses: number };
};

type PayrollSummary = {
    advanceAmount: number;
    salaryAmount: number;
    advanceDate: Date;
    salaryDate: Date;
    firstHalfEarnings: number;
    secondHalfEarnings: number;
    monthlyBonuses: number;
};

const defaultStats: CalculatedStatistics = {
    baseEarnings: 0,
    totalHours: 0,
    shiftCount: 0,
    averagePerShift: 0,
    reliabilityBonus: 0,
    anyAvailabilityBonus: 0,
    fullTimeAvailabilityBonus: 0,
    totalWithBonuses: 0,
    bestWeekdayLabel: '-',
    worstWeekdayLabel: '-',
};

const defaultComparison: MonthComparison = {
    current: { earnings: 0, hours: 0, shifts: 0, bonuses: 0 },
    previous: { earnings: 0, hours: 0, shifts: 0, bonuses: 0 },
};

const moveToFridayIfWeekend = (date: Date) => {
    const day = date.getDay();
    if (day === 6) return addDays(date, -1);
    if (day === 0) return addDays(date, -2);
    return date;
};

const normalizeTime = (time: string) => time?.split(':').slice(0, 2).join(':');

const getShiftHours = (shift: Shift) => calculateDuration(
    normalizeTime(shift.start_time),
    normalizeTime(shift.end_time),
    shift.break ?? 0,
);

const NDFL_RATE = 0.13;
const TAKE_HOME_MULTIPLIER = 1 - NDFL_RATE;
const HOLIDAY_SHIFT_BONUS = 50;

const getShiftEarnings = (shift: Shift, holidayDateSet: Set<string>) => {
    const gross = calculateEarnings(
        normalizeTime(shift.start_time),
        normalizeTime(shift.end_time),
        shift.hourly_rate ?? 0,
        shift.extra_payment ?? 0,
        shift.break ?? 0,
    );

    const grossWithHoliday = holidayDateSet.has(shift.date)
        ? (gross * 2) + HOLIDAY_SHIFT_BONUS
        : gross;
    return grossWithHoliday * TAKE_HOME_MULTIPLIER;
};

const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

export default function StatisticsScreen() {
    const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year' | 'all' | 'custom'>('month');
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
    const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);
    const [monthPickerDate, setMonthPickerDate] = useState(new Date());
    const [statistics, setStatistics] = useState<CalculatedStatistics>(defaultStats);
    const [monthComparison, setMonthComparison] = useState<MonthComparison>(defaultComparison);
    const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
    const [bonusSettings, setBonusSettings] = useState<BonusSettings>(defaultBonusSettings);
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuth();
    useTheme();
    const styles = createStyles();

    const computeStats = useCallback((
        shifts: Shift[],
        loadedBonusSettings: BonusSettings,
        withBonuses: boolean,
        holidayDateSet: Set<string>,
    ): CalculatedStatistics => {
        const baseEarnings = shifts.reduce((sum, shift) => sum + getShiftEarnings(shift, holidayDateSet), 0);
        const totalHours = shifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
        const shiftCount = shifts.length;
        const averagePerShift = shiftCount > 0 ? baseEarnings / shiftCount : 0;

        let reliabilityBonus = 0;
        let anyAvailabilityBonus = 0;
        let fullTimeAvailabilityBonus = 0;

        const weekdayAggregate = new Map<number, { earnings: number; count: number }>();

        shifts.forEach((shift) => {
            const day = parseISO(shift.date).getDay();
            const shiftEarnings = getShiftEarnings(shift, holidayDateSet);
            const record = weekdayAggregate.get(day) || { earnings: 0, count: 0 };
            record.earnings += shiftEarnings;
            record.count += 1;
            weekdayAggregate.set(day, record);
        });

        let bestDay = -1;
        let worstDay = -1;
        let bestAvg = -Infinity;
        let worstAvg = Infinity;

        weekdayAggregate.forEach((value, day) => {
            const avg = value.earnings / value.count;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestDay = day;
            }
            if (avg < worstAvg) {
                worstAvg = avg;
                worstDay = day;
            }
        });

        if (withBonuses && loadedBonusSettings.bonusSystemEnabled) {
            const monthlyMap = new Map<string, { earnings: number; hours: number }>();
            const weeklyMap = new Map<string, { hours: number; hasWeekendShift: boolean }>();

            shifts.forEach((shift) => {
                const shiftDate = parseISO(shift.date);
                const monthKey = format(shiftDate, 'yyyy-MM');
                const weekKey = format(startOfWeek(shiftDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

                const shiftHours = getShiftHours(shift);
                const shiftEarnings = getShiftEarnings(shift, holidayDateSet);

                const monthRecord = monthlyMap.get(monthKey) || { earnings: 0, hours: 0 };
                monthRecord.earnings += shiftEarnings;
                monthRecord.hours += shiftHours;
                monthlyMap.set(monthKey, monthRecord);

                const weekRecord = weeklyMap.get(weekKey) || { hours: 0, hasWeekendShift: false };
                weekRecord.hours += shiftHours;
                const day = shiftDate.getDay();
                if (day === 0 || day === 6) {
                    weekRecord.hasWeekendShift = true;
                }
                weeklyMap.set(weekKey, weekRecord);
            });

            monthlyMap.forEach((monthData) => {
                if (monthData.hours >= 50) {
                    reliabilityBonus += monthData.earnings * 0.15;
                }
            });

            weeklyMap.forEach((weekData) => {
                if (loadedBonusSettings.anyAvailabilityBonusEnabled && weekData.hours >= 40) {
                    anyAvailabilityBonus += 17000 * TAKE_HOME_MULTIPLIER;
                }

                if (
                    loadedBonusSettings.fullTimeAvailabilityBonusEnabled
                    && weekData.hours >= 35
                    && weekData.hasWeekendShift
                ) {
                    fullTimeAvailabilityBonus += 10000 * TAKE_HOME_MULTIPLIER;
                }
            });
        }

        const totalWithBonuses = baseEarnings + reliabilityBonus + anyAvailabilityBonus + fullTimeAvailabilityBonus;

        return {
            baseEarnings,
            totalHours,
            shiftCount,
            averagePerShift,
            reliabilityBonus,
            anyAvailabilityBonus,
            fullTimeAvailabilityBonus,
            totalWithBonuses,
            bestWeekdayLabel: bestDay === -1 ? '-' : `В среднем лучше всего зарабатываешь в ${weekdayNames[bestDay]}`,
            worstWeekdayLabel: worstDay === -1 ? '-' : `Наименьший средний доход — в ${weekdayNames[worstDay]}`,
        };
    }, []);

    const fetchStatistics = useCallback(async () => {
        try {
            if (!user) return;

            let query = supabase
                .from('shifts')
                .select('*')
                .eq('user_id', user.id);

            const now = new Date();
            let startForCurrent = '';
            let endForCurrent = '';

            if (selectedPeriod === 'month') {
                startForCurrent = format(startOfMonth(monthPickerDate), 'yyyy-MM-dd');
                endForCurrent = format(endOfMonth(monthPickerDate), 'yyyy-MM-dd');
                query = query.gte('date', startForCurrent).lte('date', endForCurrent);
            } else if (selectedPeriod === 'year') {
                startForCurrent = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
                endForCurrent = format(endOfMonth(now), 'yyyy-MM-dd');
                query = query.gte('date', startForCurrent).lte('date', endForCurrent);
            } else if (selectedPeriod === 'custom') {
                startForCurrent = customStartDate <= customEndDate ? customStartDate : customEndDate;
                endForCurrent = customStartDate <= customEndDate ? customEndDate : customStartDate;
                query = query.gte('date', startForCurrent).lte('date', endForCurrent);
            }

            const [{ data, error }, loadedBonusSettings, holidayDateSet] = await Promise.all([
                query,
                loadBonusSettings(),
                loadHolidayDateSet(),
            ]);

            if (error) throw error;

            const currentShifts = (data || []) as Shift[];
            setBonusSettings(loadedBonusSettings);
            setStatistics(computeStats(currentShifts, loadedBonusSettings, selectedPeriod === 'month', holidayDateSet));

            if (selectedPeriod === 'month') {
                const prevMonthDate = addMonths(monthPickerDate, -1);
                const prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
                const prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd');

                const { data: prevData, error: prevError } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('date', prevStart)
                    .lte('date', prevEnd);

                if (prevError) throw prevError;

                const prevStats = computeStats((prevData || []) as Shift[], loadedBonusSettings, true, holidayDateSet);
                const currentStats = computeStats(currentShifts, loadedBonusSettings, true, holidayDateSet);

                const monthlyBonuses = Math.max(0, currentStats.totalWithBonuses - currentStats.baseEarnings);
                const firstHalfEarnings = currentShifts
                    .filter((shift) => parseISO(shift.date).getDate() <= 15)
                    .reduce((sum, shift) => sum + getShiftEarnings(shift, holidayDateSet), 0);
                const secondHalfEarnings = Math.max(0, currentStats.baseEarnings - firstHalfEarnings);
                const advanceAmount = firstHalfEarnings * 0.8;
                const salaryAmount = (firstHalfEarnings * 0.2) + secondHalfEarnings + monthlyBonuses;

                setMonthComparison({
                    current: {
                        earnings: currentStats.baseEarnings,
                        hours: currentStats.totalHours,
                        shifts: currentStats.shiftCount,
                        bonuses: monthlyBonuses,
                    },
                    previous: {
                        earnings: prevStats.baseEarnings,
                        hours: prevStats.totalHours,
                        shifts: prevStats.shiftCount,
                        bonuses: prevStats.totalWithBonuses - prevStats.baseEarnings,
                    },
                });

                const advanceDate = moveToFridayIfWeekend(new Date(monthPickerDate.getFullYear(), monthPickerDate.getMonth(), 27));
                const salaryDate = moveToFridayIfWeekend(new Date(monthPickerDate.getFullYear(), monthPickerDate.getMonth() + 1, 12));

                setPayrollSummary({
                    advanceAmount,
                    salaryAmount,
                    advanceDate,
                    salaryDate,
                    firstHalfEarnings,
                    secondHalfEarnings,
                    monthlyBonuses,
                });
            } else {
                setMonthComparison(defaultComparison);
                setPayrollSummary(null);
            }
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    }, [computeStats, customEndDate, customStartDate, monthPickerDate, selectedPeriod, user]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    const onCustomStartChange = (_event: any, date?: Date) => {
        if (Platform.OS === 'android') setShowCustomStartPicker(false);
        if (date) setCustomStartDate(format(date, 'yyyy-MM-dd'));
    };

    const onCustomEndChange = (_event: any, date?: Date) => {
        if (Platform.OS === 'android') setShowCustomEndPicker(false);
        if (date) setCustomEndDate(format(date, 'yyyy-MM-dd'));
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: Colors.background }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={async () => {
                        setRefreshing(true);
                        await fetchStatistics();
                        setRefreshing(false);
                    }}
                    tintColor={Colors.primary}
                />
            }
        >
            <View style={{ padding: 20, backgroundColor: Colors.primary }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: Colors.onPrimary }}>
                    Статистика
                </Text>
            </View>

            <View style={styles.periodGrid}>
                {(['month', 'year', 'all', 'custom'] as const).map((period) => (
                    <TouchableOpacity
                        key={period}
                        style={[
                            styles.periodButton,
                            selectedPeriod === period && styles.periodButtonActive,
                        ]}
                        onPress={() => setSelectedPeriod(period)}
                    >
                        <Text
                            style={[
                                styles.periodText,
                                selectedPeriod === period && styles.periodTextActive,
                            ]}
                        >
                            {period === 'month'
                                ? 'Месяц'
                                : period === 'year'
                                    ? 'Год'
                                    : period === 'all'
                                        ? 'Все время'
                                        : 'Свой период'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selectedPeriod === 'month' && (
                <View style={styles.monthSelectorWrap}>
                    <Text style={styles.monthSelectorLabel}>Выбранный месяц</Text>
                    <View style={styles.monthSelectorRow}>
                        <TouchableOpacity
                            style={styles.monthArrowButton}
                            onPress={() => setMonthPickerDate((prev) => addMonths(prev, -1))}
                        >
                            <Text style={styles.monthArrowText}>‹</Text>
                        </TouchableOpacity>

                        <View style={styles.monthTitleWrap}>
                            <Text style={styles.monthSelectorText}>
                                {format(monthPickerDate, 'LLLL yyyy', { locale: ru })}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.monthArrowButton}
                            onPress={() => setMonthPickerDate((prev) => addMonths(prev, 1))}
                        >
                            <Text style={styles.monthArrowText}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {selectedPeriod === 'custom' && (
                <View style={{ backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 14 }}>
                    <Text style={{ fontSize: 14, color: Colors.gray, marginBottom: 10 }}>Выберите диапазон дат</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10 }}
                            onPress={() => setShowCustomStartPicker(true)}
                        >
                            <Text style={{ color: Colors.darkGray }}>С: {format(new Date(`${customStartDate}T00:00:00`), 'dd.MM.yyyy')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10 }}
                            onPress={() => setShowCustomEndPicker(true)}
                        >
                            <Text style={{ color: Colors.darkGray }}>По: {format(new Date(`${customEndDate}T00:00:00`), 'dd.MM.yyyy')}</Text>
                        </TouchableOpacity>
                    </View>
                    {showCustomStartPicker && (
                        <DateTimePicker
                            value={new Date(`${customStartDate}T00:00:00`)}
                            mode="date"
                            onChange={onCustomStartChange}
                        />
                    )}
                    {showCustomEndPicker && (
                        <DateTimePicker
                            value={new Date(`${customEndDate}T00:00:00`)}
                            mode="date"
                            onChange={onCustomEndChange}
                        />
                    )}
                </View>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16 }}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                        {statistics.baseEarnings.toFixed(2)} ₽
                    </Text>
                    <Text style={styles.statLabel}>База (без премий)</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                        {statistics.totalHours.toFixed(1)}
                    </Text>
                    <Text style={styles.statLabel}>Всего часов</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                        {statistics.shiftCount}
                    </Text>
                    <Text style={styles.statLabel}>Количество смен</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                        {statistics.averagePerShift.toFixed(2)} ₽
                    </Text>
                    <Text style={styles.statLabel}>Среднее за смену</Text>
                </View>
            </View>

            <View style={styles.dayInsightsCard}>
                <Text style={styles.dayInsightsTitle}>Лучший/худший день недели</Text>
                <Text style={styles.dayInsightLine}>✅ {statistics.bestWeekdayLabel}</Text>
                <Text style={styles.dayInsightLine}>📉 {statistics.worstWeekdayLabel}</Text>
            </View>

            {selectedPeriod === 'month' && (
                <>
                    <View style={styles.comparisonCard}>
                        <Text style={styles.comparisonTitle}>Сравнение месяцев</Text>
                        <Text style={styles.comparisonLine}>Текущий: {monthComparison.current.earnings.toFixed(2)} ₽, {monthComparison.current.hours.toFixed(1)} ч, {monthComparison.current.shifts} смен</Text>
                        <Text style={styles.comparisonLine}>Прошлый: {monthComparison.previous.earnings.toFixed(2)} ₽, {monthComparison.previous.hours.toFixed(1)} ч, {monthComparison.previous.shifts} смен</Text>
                        <Text style={styles.comparisonDelta}>
                            Δ Доход: {(monthComparison.current.earnings - monthComparison.previous.earnings).toFixed(2)} ₽ · Δ Часы: {(monthComparison.current.hours - monthComparison.previous.hours).toFixed(1)}
                        </Text>
                    </View>

                    <View style={styles.bonusSection}>
                        <Text style={styles.bonusSectionTitle}>Премии</Text>
                        <Text style={styles.bonusRow}>
                            🔹 Надежность (50ч/мес, +15%): {statistics.reliabilityBonus.toFixed(2)} ₽
                        </Text>
                        <Text style={styles.bonusRow}>
                            🔹 Любые временные возможности (+17 000 ₽/нед): {statistics.anyAvailabilityBonus.toFixed(2)} ₽
                        </Text>
                        <Text style={styles.bonusRow}>
                            🔹 Полные временные возможности (+10 000 ₽/нед): {statistics.fullTimeAvailabilityBonus.toFixed(2)} ₽
                        </Text>
                        <Text style={styles.bonusInfo}>
                            {bonusSettings.bonusSystemEnabled
                                ? 'Система премий включена'
                                : 'Система премий выключена в настройках'}
                        </Text>

                        <View style={styles.totalCard}>
                            <Text style={styles.totalLabel}>Итог с премиями</Text>
                            <Text style={styles.totalValue}>{statistics.totalWithBonuses.toFixed(2)} ₽</Text>
                        </View>
                    </View>

                    <View style={styles.payrollCard}>
                        <Text style={styles.payrollTitle}>Аванс и зарплата</Text>
                        {payrollSummary ? (
                            <>
                                <Text style={styles.payrollLine}>
                                    Аванс: {payrollSummary.advanceAmount.toFixed(2)} ₽ · {format(payrollSummary.advanceDate, 'dd.MM.yyyy')}
                                </Text>
                                <Text style={styles.payrollSubLine}>
                                    80% от дохода за 1–15 число ({payrollSummary.firstHalfEarnings.toFixed(2)} ₽)
                                </Text>

                                <Text style={[styles.payrollLine, { marginTop: 10 }]}>
                                    Зарплата: {payrollSummary.salaryAmount.toFixed(2)} ₽ · {format(payrollSummary.salaryDate, 'dd.MM.yyyy')}
                                </Text>
                                <Text style={styles.payrollSubLine}>
                                    20% за 1–15 ({(payrollSummary.firstHalfEarnings * 0.2).toFixed(2)} ₽) + доход 16–конец ({payrollSummary.secondHalfEarnings.toFixed(2)} ₽) + премии ({payrollSummary.monthlyBonuses.toFixed(2)} ₽)
                                </Text>
                                <Text style={styles.payrollHint}>Суммы уже рассчитаны с учетом НДФЛ 13% и двойной ставки в праздники РФ.</Text>
                            </>
                        ) : (
                            <Text style={styles.payrollSubLine}>Данные появятся при выборе периода «Месяц».</Text>
                        )}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const createStyles = () => StyleSheet.create({
    periodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: Colors.white,
    },
    periodButton: {
        width: '48%',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        marginBottom: 10,
        backgroundColor: 'transparent',
    },
    periodButtonActive: {
        backgroundColor: Colors.lightPrimary,
    },
    periodText: {
        fontSize: 14,
        color: Colors.gray,
        fontWeight: '500',
        textAlign: 'center',
    },
    periodTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    monthSelectorWrap: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        padding: 14,
    },
    monthSelectorLabel: {
        fontSize: 13,
        color: Colors.gray,
        marginBottom: 8,
    },
    monthSelectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    monthArrowButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
    },
    monthArrowText: {
        fontSize: 24,
        color: Colors.primary,
        lineHeight: 26,
    },
    monthTitleWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthSelectorText: {
        fontSize: 16,
        color: Colors.darkGray,
        textTransform: 'capitalize',
    },
    statCard: {
        width: '48%',
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        margin: '1%',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    statLabel: {
        fontSize: 14,
        color: Colors.gray,
        textAlign: 'center',
    },
    dayInsightsCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: Colors.white,
    },
    dayInsightsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 8,
    },
    dayInsightLine: {
        fontSize: 14,
        color: Colors.darkGray,
        marginBottom: 4,
    },
    comparisonCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: Colors.white,
    },
    comparisonTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 8,
    },
    comparisonLine: {
        fontSize: 14,
        color: Colors.darkGray,
        marginBottom: 4,
    },
    comparisonDelta: {
        marginTop: 4,
        fontSize: 13,
        color: Colors.gray,
    },
    bonusSection: {
        marginHorizontal: 16,
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        backgroundColor: Colors.white,
    },
    bonusSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 10,
    },
    bonusRow: {
        fontSize: 14,
        color: Colors.darkGray,
        marginBottom: 8,
    },
    bonusInfo: {
        marginTop: 2,
        marginBottom: 10,
        fontSize: 12,
        color: Colors.gray,
    },
    totalCard: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 10,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.darkGray,
    },
    totalValue: {
        marginTop: 4,
        fontSize: 24,
        fontWeight: '700',
        color: Colors.primary,
    },
    payrollCard: {
        marginHorizontal: 16,
        marginBottom: 28,
        padding: 16,
        borderRadius: 12,
        backgroundColor: Colors.white,
    },
    payrollTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 10,
    },
    payrollLine: {
        fontSize: 15,
        color: Colors.darkGray,
        fontWeight: '600',
    },
    payrollSubLine: {
        marginTop: 4,
        fontSize: 13,
        color: Colors.gray,
        lineHeight: 18,
    },
    payrollHint: {
        marginTop: 10,
        fontSize: 12,
        color: Colors.gray,
        lineHeight: 17,
    },
});
