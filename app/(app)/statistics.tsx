import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDate,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { getShiftsWithOffline } from '@/services/offlineShifts';
import MonthlyChart from '@/components/MonthlyChart';
import { applyNdfl, calculateDuration, calculateEarnings } from '@/utils/calculations';
import { BonusSettings, defaultBonusSettings, loadBonusSettings } from '@/services/bonusSettings';
import { loadCachedProfile, saveCachedProfile } from '@/services/profileCache';
import { loadTaxSettings } from '@/services/taxSettings';
import { useTheme } from '@/hooks/useTheme';
import { loadHolidayDateSet } from '@/services/holidays';

const DEFAULT_ADVANCE_DAY = 26;
const DEFAULT_SALARY_DAY = 11;

type Shift = {
  id: string | number;
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
  anyAvailabilityBonus: number;
  hourlyRateBonus: number;
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

type ProfilePayrollSettings = {
  advance_day: number | null;
  salary_day: number | null;
  any_availability_bonus_amount: number | null;
};

type BonusSettingsWithAmount = BonusSettings & {
  anyAvailabilityBonusAmount: number;
};

const loadProfilePayrollSettings = async (userId: string): Promise<ProfilePayrollSettings> => {
  try {
    const { data, error } = await supabase
        .from('profiles')
        .select('advance_day, salary_day, any_availability_bonus_amount')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;

    const profile = {
      advance_day: data?.advance_day ?? null,
      salary_day: data?.salary_day ?? null,
      any_availability_bonus_amount: data?.any_availability_bonus_amount ?? null,
    };

    await saveCachedProfile(userId, profile);
    return profile;
  } catch {
    const cached = await loadCachedProfile(userId);
    return {
      advance_day: typeof cached.advance_day === 'number' ? cached.advance_day : null,
      salary_day: typeof cached.salary_day === 'number' ? cached.salary_day : null,
      any_availability_bonus_amount:
          typeof cached.any_availability_bonus_amount === 'number' ? cached.any_availability_bonus_amount : null,
    };
  }
};

const defaultStats: CalculatedStatistics = {
  baseEarnings: 0,
  totalHours: 0,
  shiftCount: 0,
  averagePerShift: 0,
  anyAvailabilityBonus: 0,
  hourlyRateBonus: 0,
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

const getShiftHours = (shift: Shift) =>
    calculateDuration(normalizeTime(shift.start_time), normalizeTime(shift.end_time), shift.break ?? 0);

const getShiftEarnings = (shift: Shift, holidayDateSet: Set<string>, includeNdfl: boolean) => {
  const gross = calculateEarnings(
      normalizeTime(shift.start_time),
      normalizeTime(shift.end_time),
      shift.hourly_rate ?? 0,
      shift.extra_payment ?? 0,
      shift.break ?? 0
  );

  const grossWithHoliday = holidayDateSet.has(shift.date) ? gross * 2 : gross;
  return applyNdfl(grossWithHoliday, includeNdfl);
};

const getClampedMonthDate = (year: number, month: number, preferredDay: number) => {
  const lastDay = getDate(endOfMonth(new Date(year, month, 1)));
  const safeDay = Math.max(1, Math.min(lastDay, preferredDay));
  return moveToFridayIfWeekend(new Date(year, month, safeDay));
};

const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

const formatMoney = (amount: number) => {
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [includeNdfl, setIncludeNdfl] = useState(false);
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const computeStats = useCallback(
      (
          shifts: Shift[],
          loadedBonusSettings: BonusSettingsWithAmount,
          withBonuses: boolean,
          holidayDateSet: Set<string>,
          includeNdfl: boolean
      ): CalculatedStatistics => {
        const baseEarnings = shifts.reduce((sum, shift) => sum + getShiftEarnings(shift, holidayDateSet, includeNdfl), 0);
        const totalHours = shifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
        const shiftCount = shifts.length;
        const averagePerShift = shiftCount > 0 ? baseEarnings / shiftCount : 0;

        let anyAvailabilityBonus = 0;
        let hourlyRateBonus = 0;

        const weekdayAggregate = new Map<number, { earnings: number; count: number }>();

        shifts.forEach((shift) => {
          const day = parseISO(shift.date).getDay();
          const shiftEarnings = getShiftEarnings(shift, holidayDateSet, includeNdfl);
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

        if (withBonuses && loadedBonusSettings.isVkusnoWorker) {
          if (loadedBonusSettings.anyAvailabilityBonusEnabled) {
            const fixedBonusAmount = Math.max(0, loadedBonusSettings.anyAvailabilityBonusAmount ?? 0);
            anyAvailabilityBonus = applyNdfl(fixedBonusAmount, includeNdfl);
          }
          if (loadedBonusSettings.hourlyRateBonusEnabled && totalHours >= 120) {
            hourlyRateBonus = applyNdfl(totalHours * 100, includeNdfl);
          }
        }

        const totalWithBonuses = baseEarnings + anyAvailabilityBonus + hourlyRateBonus;

        return {
          baseEarnings,
          totalHours,
          shiftCount,
          averagePerShift,
          anyAvailabilityBonus,
          hourlyRateBonus,
          totalWithBonuses,
          bestWeekdayLabel: bestDay === -1 ? '-' : `В среднем больше всего в ${weekdayNames[bestDay]}`,
          worstWeekdayLabel: worstDay === -1 ? '-' : `Меньше всего в ${weekdayNames[worstDay]}`,
        };
      },
      []
  );

  const fetchStatistics = useCallback(async () => {
    try {
      if (!user) return;
      setIsFetchingData(true);

      const now = new Date();
      const currentStart =
          selectedPeriod === 'month'
              ? format(startOfMonth(monthPickerDate), 'yyyy-MM-dd')
              : selectedPeriod === 'year'
                  ? format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd')
                  : selectedPeriod === 'custom'
                      ? customStartDate <= customEndDate
                          ? customStartDate
                          : customEndDate
                      : '2000-01-01';

      const currentEnd =
          selectedPeriod === 'month'
              ? format(endOfMonth(monthPickerDate), 'yyyy-MM-dd')
              : selectedPeriod === 'year'
                  ? format(endOfMonth(now), 'yyyy-MM-dd')
                  : selectedPeriod === 'custom'
                      ? customStartDate <= customEndDate
                          ? customEndDate
                          : customStartDate
                      : '2100-12-31';

      const [currentPayload, loadedBonusSettings, taxSettings, holidayDateSet, profileDays] = await Promise.all([
        getShiftsWithOffline({
          userId: user.id,
          start: currentStart,
          end: currentEnd,
        }),
        loadBonusSettings(),
        loadTaxSettings(),
        loadHolidayDateSet(),
        loadProfilePayrollSettings(user.id),
      ]);

      const advanceDay = Math.max(1, Math.min(31, profileDays.advance_day ?? DEFAULT_ADVANCE_DAY));
      const salaryDay = Math.max(1, Math.min(31, profileDays.salary_day ?? DEFAULT_SALARY_DAY));
      const anyAvailabilityBonusAmount = Math.max(0, profileDays.any_availability_bonus_amount ?? 12000);

      const bonusSettingsWithProfileAmount: BonusSettingsWithAmount = {
        ...loadedBonusSettings,
        anyAvailabilityBonusAmount,
      };

      const currentShifts = currentPayload.shifts as Shift[];
      setShifts(currentShifts);
      setIncludeNdfl(taxSettings.includeNdfl);
      setBonusSettings(loadedBonusSettings);
      setStatistics(computeStats(currentShifts, bonusSettingsWithProfileAmount, selectedPeriod === 'month', holidayDateSet, taxSettings.includeNdfl));

      if (selectedPeriod === 'month') {
        const prevMonthDate = addMonths(monthPickerDate, -1);
        const prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
        const prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd');

        const prevPayload = await getShiftsWithOffline({
          userId: user.id,
          start: prevStart,
          end: prevEnd,
        });

        const prevStats = computeStats(prevPayload.shifts as Shift[], bonusSettingsWithProfileAmount, true, holidayDateSet, taxSettings.includeNdfl);
        const currentStats = computeStats(currentShifts, bonusSettingsWithProfileAmount, true, holidayDateSet, taxSettings.includeNdfl);

        const monthlyBonuses = Math.max(0, currentStats.totalWithBonuses - currentStats.baseEarnings);
        const firstHalfEarnings = currentShifts
            .filter((shift) => parseISO(shift.date).getDate() <= 15)
            .reduce((sum, shift) => sum + getShiftEarnings(shift, holidayDateSet, taxSettings.includeNdfl), 0);
        const secondHalfEarnings = Math.max(0, currentStats.baseEarnings - firstHalfEarnings);

        const advanceAmount = firstHalfEarnings;
        const salaryAmount = secondHalfEarnings + monthlyBonuses;

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

        const advanceDate = getClampedMonthDate(monthPickerDate.getFullYear(), monthPickerDate.getMonth(), advanceDay);
        const salaryDate = getClampedMonthDate(monthPickerDate.getFullYear(), monthPickerDate.getMonth() + 1, salaryDay);

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
      console.error(error);
    } finally {
      setIsFetchingData(false);
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

  const deltaEarnings = monthComparison.current.earnings - monthComparison.previous.earnings;
  const isPositiveDelta = deltaEarnings >= 0;

  return (
      <View style={styles.background}>
        {/*<View style={styles.headerBackground}>*/}
        {/*  <Text style={styles.headerTitle}>Статистика</Text>*/}
        {/*</View>*/}

        <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.scrollContent}
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
          <View style={styles.periodControlWrap}>
            <View style={styles.segmentedControl}>
              {(['month', 'year', 'all', 'custom'] as const).map((period) => (
                  <TouchableOpacity
                      key={period}
                      style={[styles.segmentButton, selectedPeriod === period && styles.segmentButtonActive]}
                      onPress={() => setSelectedPeriod(period)}
                      activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, selectedPeriod === period && styles.segmentTextActive]}>
                      {period === 'month' ? 'Месяц' : period === 'year' ? 'Год' : period === 'all' ? 'Всё время' : 'Свой'}
                    </Text>
                  </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedPeriod === 'month' && (
              <View style={styles.monthSelectorRow}>
                <TouchableOpacity style={styles.monthArrowButton} onPress={() => setMonthPickerDate((prev) => addMonths(prev, -1))}>
                  <Text style={styles.monthArrowText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.monthTitleWrap}>
                  <Text style={styles.monthSelectorText}>{format(monthPickerDate, 'LLLL yyyy', { locale: ru })}</Text>
                </View>
                <TouchableOpacity style={styles.monthArrowButton} onPress={() => setMonthPickerDate((prev) => addMonths(prev, 1))}>
                  <Text style={styles.monthArrowText}>›</Text>
                </TouchableOpacity>
              </View>
          )}

          {selectedPeriod === 'custom' && (
              <View style={styles.customRangeCard}>
                <Text style={styles.customRangeLabel}>Диапазон дат</Text>
                <View style={styles.customRangeRow}>
                  <TouchableOpacity style={[styles.customRangeButton, styles.customRangeButtonLeft]} onPress={() => setShowCustomStartPicker(true)}>
                    <Text style={styles.customRangeButtonText}>С: {format(new Date(`${customStartDate}T00:00:00`), 'dd.MM.yyyy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.customRangeButton} onPress={() => setShowCustomEndPicker(true)}>
                    <Text style={styles.customRangeButtonText}>По: {format(new Date(`${customEndDate}T00:00:00`), 'dd.MM.yyyy')}</Text>
                  </TouchableOpacity>
                </View>
                {showCustomStartPicker && <DateTimePicker value={new Date(`${customStartDate}T00:00:00`)} mode="date" onChange={onCustomStartChange} />}
                {showCustomEndPicker && <DateTimePicker value={new Date(`${customEndDate}T00:00:00`)} mode="date" onChange={onCustomEndChange} />}
              </View>
          )}

          {isFetchingData ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
          ) : (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Базовый доход (без премий)</Text>
                  <Text style={styles.heroValue}>{formatMoney(statistics.baseEarnings)} ₽</Text>
                </View>

                <View style={styles.miniStatsRow}>
                  <View style={styles.miniStatCard}>
                    <Text style={styles.miniStatValue}>{statistics.totalHours.toFixed(1)}</Text>
                    <Text style={styles.miniStatLabel}>Часов</Text>
                  </View>
                  <View style={styles.miniStatCard}>
                    <Text style={styles.miniStatValue}>{statistics.shiftCount}</Text>
                    <Text style={styles.miniStatLabel}>Смен</Text>
                  </View>
                  <View style={styles.miniStatCard}>
                    <Text style={styles.miniStatValue}>{formatMoney(statistics.averagePerShift)}</Text>
                    <Text style={styles.miniStatLabel}>В среднем ₽</Text>
                  </View>
                </View>

                {selectedPeriod === 'month' && (
                    <View style={styles.chartWrapper}>
                      <MonthlyChart
                          shifts={shifts}
                          currentDate={monthPickerDate}
                          includeNdfl={includeNdfl}
                          applyNdfl={applyNdfl}
                      />
                    </View>
                )}

                {selectedPeriod === 'month' && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>📈 Динамика к прошлому месяцу</Text>
                      </View>
                      <View style={styles.comparisonRow}>
                        <Text style={styles.comparisonLabel}>Изменение дохода:</Text>
                        <Text style={[styles.comparisonDelta, { color: isPositiveDelta ? Colors.success : Colors.error }]}>
                          {isPositiveDelta ? '+' : ''}{formatMoney(deltaEarnings)} ₽
                        </Text>
                      </View>
                      <View style={styles.comparisonDivider} />
                      <View style={styles.comparisonRow}>
                        <Text style={styles.comparisonLabel}>Текущий месяц:</Text>
                        <Text style={styles.comparisonValue}>{monthComparison.current.hours.toFixed(1)} ч</Text>
                      </View>
                      <View style={styles.comparisonRow}>
                        <Text style={styles.comparisonLabel}>Прошлый месяц:</Text>
                        <Text style={styles.comparisonValue}>{monthComparison.previous.hours.toFixed(1)} ч</Text>
                      </View>
                    </View>
                )}

                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>📊 Доход в дни недели</Text>
                  </View>
                  <Text style={styles.insightLine}>🔥 {statistics.bestWeekdayLabel}</Text>
                  <Text style={styles.insightLine}>💤 {statistics.worstWeekdayLabel}</Text>
                </View>

                {selectedPeriod === 'month' && bonusSettings.isVkusnoWorker && (
                    <>
                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>✨ Премии</Text>
                        </View>
                        <View style={styles.bonusRowItem}>
                          <Text style={styles.bonusLabel}>Временные возможности</Text>
                          <Text style={styles.bonusValue}>{formatMoney(statistics.anyAvailabilityBonus)} ₽</Text>
                        </View>
                        <View style={styles.bonusRowItem}>
                          <Text style={styles.bonusLabel}>Бонус к ставке (120+ ч)</Text>
                          <Text style={styles.bonusValue}>{formatMoney(statistics.hourlyRateBonus)} ₽</Text>
                        </View>

                        <View style={styles.totalBlock}>
                          <Text style={styles.totalBlockLabel}>Итого с премиями</Text>
                          <Text style={styles.totalBlockValue}>{formatMoney(statistics.totalWithBonuses)} ₽</Text>
                        </View>
                      </View>

                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>💳 Выплаты</Text>
                        </View>
                        {payrollSummary ? (
                            <>
                              <View style={styles.payrollItem}>
                                <View style={styles.payrollItemHeader}>
                                  <Text style={styles.payrollItemTitle}>Аванс</Text>
                                  <Text style={styles.payrollItemAmount}>{formatMoney(payrollSummary.advanceAmount)} ₽</Text>
                                </View>
                                <Text style={styles.payrollItemDesc}>
                                  Ожидается ~ {format(payrollSummary.advanceDate, 'dd.MM.yyyy')}
                                </Text>
                                <Text style={styles.payrollSubLine}>
                                  100% дохода за 1–15 число ({formatMoney(payrollSummary.firstHalfEarnings)} ₽)
                                </Text>
                              </View>

                              <View style={styles.comparisonDivider} />

                              <View style={styles.payrollItem}>
                                <View style={styles.payrollItemHeader}>
                                  <Text style={styles.payrollItemTitle}>Зарплата</Text>
                                  <Text style={styles.payrollItemAmount}>{formatMoney(payrollSummary.salaryAmount)} ₽</Text>
                                </View>
                                <Text style={styles.payrollItemDesc}>
                                  Ожидается ~ {format(payrollSummary.salaryDate, 'dd.MM.yyyy')}
                                </Text>
                                <Text style={styles.payrollSubLine}>
                                  Доход 16–конец ({formatMoney(payrollSummary.secondHalfEarnings)} ₽) + премии ({formatMoney(payrollSummary.monthlyBonuses)} ₽)
                                </Text>
                              </View>

                              <Text style={styles.payrollHint}>
                                Даты берутся из настроек профиля. Если число попадает на выходной, выплата переносится на пятницу.
                              </Text>
                            </>
                        ) : (
                            <Text style={styles.payrollHint}>Данные появятся при выборе периода «Месяц».</Text>
                        )}
                      </View>
                    </>
                )}
              </>
          )}
        </ScrollView>
      </View>
  );
}

const createStyles = () =>
    StyleSheet.create({
      background: {
        flex: 1,
        backgroundColor: Colors.background,
      },
      scrollFlex: {
        flex: 1,
      },
      scrollContent: {
        paddingBottom: 40,
      },
      headerBackground: {
        backgroundColor: Colors.primary,
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingBottom: 20,
        paddingHorizontal: 20,
      },
      headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.onPrimary,
        letterSpacing: 0.5,
      },
      periodControlWrap: {
        marginTop: 20,
        paddingHorizontal: 16,
      },
      segmentedControl: {
        flexDirection: 'row',
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 4,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      },
      segmentButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
      },
      segmentButtonActive: {
        backgroundColor: Colors.white,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
      segmentText: {
        fontSize: 13,
        color: Colors.gray,
        fontWeight: '600',
      },
      segmentTextActive: {
        color: Colors.primary,
        fontWeight: '800',
      },
      monthSelectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 20,
      },
      monthArrowButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      },
      monthArrowText: {
        fontSize: 20,
        color: Colors.primary,
        fontWeight: '600',
        marginTop: -2,
      },
      monthTitleWrap: {
        flex: 1,
        alignItems: 'center',
      },
      monthSelectorText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.darkGray,
        textTransform: 'capitalize',
      },
      heroCard: {
        backgroundColor: Colors.primary,
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 6,
      },
      heroLabel: {
        fontSize: 14,
        color: Colors.onPrimary,
        opacity: 0.8,
        marginBottom: 6,
        fontWeight: '500',
      },
      heroValue: {
        fontSize: 34,
        fontWeight: '800',
        color: Colors.onPrimary,
        letterSpacing: 1,
      },
      miniStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginTop: 12,
      },
      miniStatCard: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
      },
      miniStatValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.darkGray,
        marginBottom: 4,
      },
      miniStatLabel: {
        fontSize: 12,
        color: Colors.gray,
        fontWeight: '500',
      },
      chartWrapper: {
        marginTop: 10,
      },
      card: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 20,
        padding: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
      },
      cardHeader: {
        marginBottom: 16,
      },
      cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.darkGray,
      },
      comparisonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      },
      comparisonLabel: {
        fontSize: 14,
        color: Colors.gray,
        fontWeight: '500',
      },
      comparisonValue: {
        fontSize: 15,
        color: Colors.darkGray,
        fontWeight: '700',
      },
      comparisonDelta: {
        fontSize: 16,
        fontWeight: '800',
      },
      comparisonDivider: {
        height: 1,
        backgroundColor: Colors.border,
        opacity: 0.5,
        marginVertical: 12,
      },
      insightLine: {
        fontSize: 15,
        color: Colors.darkGray,
        fontWeight: '500',
        marginBottom: 8,
        lineHeight: 22,
      },
      bonusRowItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
      bonusLabel: {
        fontSize: 14,
        color: Colors.gray,
        flex: 1,
      },
      bonusValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.darkGray,
      },
      totalBlock: {
        backgroundColor: Colors.lightPrimary,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      totalBlockLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.primary,
      },
      totalBlockValue: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.primary,
      },
      payrollItem: {
        marginBottom: 4,
      },
      payrollItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 4,
      },
      payrollItemTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.darkGray,
      },
      payrollItemAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.darkGray,
      },
      payrollItemDesc: {
        fontSize: 13,
        color: Colors.gray,
      },
      payrollSubLine: {
        marginTop: 6,
        fontSize: 13,
        color: Colors.gray,
        lineHeight: 18,
      },
      payrollHint: {
        marginTop: 14,
        fontSize: 12,
        color: Colors.gray,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 16,
      },
      customRangeCard: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 16,
        padding: 16,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
      },
      customRangeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.darkGray,
        marginBottom: 12,
      },
      customRangeRow: {
        flexDirection: 'row',
      },
      customRangeButton: {
        flex: 1,
        backgroundColor: Colors.lightGray,
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
      },
      customRangeButtonLeft: {
        marginRight: 10,
      },
      customRangeButtonText: {
        color: Colors.darkGray,
        fontWeight: '600',
      },
      loaderContainer: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });