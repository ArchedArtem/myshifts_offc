import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Modal,
    Pressable,
    Alert,
    StyleSheet,
    Animated,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import ShiftCard from '@/components/ShiftCard';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { applyNdfl, calculateEarnings } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { loadHolidayDateSet } from '@/services/holidays';
import { defaultTaxSettings, loadTaxSettings } from '@/services/taxSettings';
import { deleteShiftOfflineAware, getShiftsWithOffline } from '@/services/offlineShifts';

import { ActivityIndicator } from 'react-native';
import { useShiftSyncStatus } from '@/hooks/useShiftSyncStatus';
import { syncNow } from '@/services/offlineSync';


LocaleConfig.locales.ru = {
    monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthNamesShort: ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    today: 'Сегодня',
};
LocaleConfig.defaultLocale = 'ru';


interface Shift {
    id: string;
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    extra_payment: number;
    earnings: number;
    notes?: string | null;
    break?: number | null;
}

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [holidayDateSet, setHolidayDateSet] = useState<Set<string>>(new Set());
    const [includeNdfl, setIncludeNdfl] = useState(defaultTaxSettings.includeNdfl);
    const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
    const [calendarKey, setCalendarKey] = useState(0);
    const [calendarOpacity] = useState(new Animated.Value(1));
    const [calendarTranslateX] = useState(new Animated.Value(0));

    const router = useRouter();
    const { user } = useAuth();
    const syncState = useShiftSyncStatus();
    useTheme();
    const styles = createStyles();

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const selectedMonthStart = startOfMonth(selectedDate);

    const availableMonths = useMemo(() => {
        const base = startOfMonth(new Date());
        return Array.from({ length: 21 }, (_, index) => addMonths(base, index - 10));
    }, []);

    const animateCalendarTransition = useCallback((direction: 1 | -1) => {
        calendarOpacity.setValue(0);
        calendarTranslateX.setValue(10 * direction);
        Animated.parallel([
            Animated.timing(calendarOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(calendarTranslateX, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start();
    }, [calendarOpacity, calendarTranslateX]);

    const applyMonthSelection = useCallback((nextDate: Date, direction: 1 | -1) => {
        setSelectedDate(nextDate);
        setCalendarKey((prev) => prev + 1);
        animateCalendarTransition(direction);
    }, [animateCalendarTransition]);

    const fetchShifts = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

            const [shiftPayload, holidays, taxSettings] = await Promise.all([
                getShiftsWithOffline({ userId: user.id, start, end }),
                loadHolidayDateSet(),
                loadTaxSettings(),
            ]);

            setShifts((shiftPayload.shifts as Shift[]) ?? []);
            setHolidayDateSet(holidays);
            setIncludeNdfl(taxSettings.includeNdfl);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate, user]);

    useFocusEffect(
        useCallback(() => {
            fetchShifts();
        }, [fetchShifts])
    );

    const markedDates = useMemo(() => {
        const marked: Record<string, any> = {};

        holidayDateSet.forEach((holidayDate) => {
            marked[holidayDate] = {
                customStyles: {
                    container: {
                        backgroundColor: Colors.lightPrimary,
                        borderWidth: 1,
                        borderColor: Colors.secondary,
                        borderRadius: 16,
                    },
                    text: {
                        color: Colors.primary,
                        fontWeight: "700",
                    },
                },
            };
        });

        shifts.forEach((shift) => {
            marked[shift.date] = {
                ...marked[shift.date],
                marked: true,
                dotColor: Colors.primary,
            };
        });

        marked[formattedDate] = {
            ...marked[formattedDate],
            selected: true,
            selectedColor: Colors.secondary,
            customStyles: {
                container: {
                    backgroundColor: Colors.secondary,
                    borderRadius: 16,
                },
                text: {
                    color: Colors.onPrimary,
                    fontWeight: "700",
                },
            },
        };

        return marked;
    }, [formattedDate, holidayDateSet, shifts]);

    const filteredShifts = shifts.filter((shift) => shift.date === formattedDate);

    const dayEarnings = filteredShifts.reduce((total, shift) => {
        const start = shift.start_time?.split(':').slice(0, 2).join(':');
        const end = shift.end_time?.split(':').slice(0, 2).join(':');
        const gross = calculateEarnings(start, end, shift.hourly_rate ?? 0, shift.extra_payment ?? 0, shift.break ?? 0);
        return total + applyNdfl(gross, includeNdfl);
    }, 0);

    const shiftTotal = (shift: Shift) => applyNdfl(
        calculateEarnings(
            shift.start_time?.split(':').slice(0, 2).join(':'),
            shift.end_time?.split(':').slice(0, 2).join(':'),
            shift.hourly_rate ?? 0,
            shift.extra_payment ?? 0,
            shift.break ?? 0,
        ),
        includeNdfl,
    );

    const handleDeleteShift = () => {
        if (!selectedShift) return;

        Alert.alert('Удалить смену', 'Вы уверены, что хотите удалить эту смену?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const result = await deleteShiftOfflineAware({
                            userId: user?.id || '',
                            shiftId: selectedShift.id,
                        });

                        setSelectedShift(null);
                        if (result.queued) {
                            Alert.alert('Офлайн режим', 'Удаление сохранено локально и отправится при появлении интернета.');
                        }
                        if (user?.id) {
                            await syncNextShiftWidgetForUser(user.id);
                        }
                        await fetchShifts();
                    } catch (error: any) {
                        Alert.alert('Ошибка', error.message || 'Не удалось удалить смену');
                    }
                },
            },
        ]);
    };

    const handleMonthChange = (monthDate: Date) => {
        const diffDirection = monthDate.getTime() >= selectedMonthStart.getTime() ? 1 : -1;
        applyMonthSelection(monthDate, diffDirection);
    };

    return (
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
            <Animated.View
                style={{
                    opacity: calendarOpacity,
                    transform: [{ translateX: calendarTranslateX }],
                }}
            >
                <Calendar
                    key={calendarKey}
                    current={formattedDate}
                    onDayPress={(day: { dateString: string }) => setSelectedDate(new Date(day.dateString))}
                    onMonthChange={(month: { dateString: string }) => {
                        handleMonthChange(new Date(month.dateString));
                    }}
                    markedDates={markedDates}
                    renderHeader={(date: Date) => (
                        <TouchableOpacity
                            style={styles.monthHeaderButton}
                            onPress={() => setIsMonthPickerVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.monthHeaderText}>{format(date, 'LLLL yyyy', { locale: ru })}</Text>
                            <Text style={styles.monthHeaderHint}>Нажмите для быстрого выбора</Text>
                        </TouchableOpacity>
                    )}
                    theme={{
                        calendarBackground: Colors.white,
                        selectedDayBackgroundColor: Colors.secondary,
                        todayTextColor: Colors.primary,
                        dayTextColor: Colors.darkGray,
                        monthTextColor: Colors.primary,
                        arrowColor: Colors.primary,
                    }}
                    firstDay={1}
                    enableSwipeMonths
                    markingType="custom"
                />
            </Animated.View>

            <View style={{ padding: 16, backgroundColor: Colors.white }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.darkGray }}>
                    {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}
                </Text>
                <Text style={{ fontSize: 16, color: Colors.primary, marginTop: 5 }}>
                    Заработок: {dayEarnings.toFixed(2)} ₽
                </Text>
            </View>

            <FlatList
                data={filteredShifts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ShiftCard
                        shift={item}
                        onPress={() => setSelectedShift(item)}
                    />
                )}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', color: Colors.gray, marginTop: 20 }}>
                        {loading ? 'Загрузка...' : 'Нет смен на эту дату'}
                    </Text>
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            />

            {(syncState.pendingCount > 0 || syncState.status === 'error') && (
                <View style={[
                    styles.syncBadge,
                    syncState.status === 'error' ? styles.syncBadgeError : styles.syncBadgePending
                ]}>
                    <Text style={styles.syncBadgeText}>
                        {syncState.status === 'error' ? 'Ошибка синхр.' : `В очереди: ${syncState.pendingCount}`}
                    </Text>
                    <TouchableOpacity
                        style={styles.syncBadgeButton}
                        onPress={() => user?.id && syncNow(user.id, { forceRefreshCache: true })}
                        disabled={syncState.syncing}
                    >
                        {syncState.syncing ? (
                            <ActivityIndicator color={Colors.darkGray} size="small" />
                        ) : (
                            <Text style={styles.syncBadgeIcon}>↻</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() =>
                    router.push({
                        pathname: '/(app)/shift-edit',
                        params: { date: formattedDate },
                    })
                }
            >
                <Text style={{ color: Colors.onPrimary, fontSize: 24, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>

            <Modal
                visible={!!selectedShift}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedShift(null)}
            >
                <Pressable style={styles.overlay} onPress={() => setSelectedShift(null)}>
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={styles.modalTitle}>
                            {selectedShift
                                ? `Смена ${format(new Date(`${selectedShift.date}T00:00:00`), 'd MMMM yyyy', { locale: ru })} года`
                                : 'Смена'}
                        </Text>
                        <Text style={styles.modalLine}>
                            ⏰ {selectedShift?.start_time?.split(':').slice(0, 2).join(':')} — {selectedShift?.end_time?.split(':').slice(0, 2).join(':')}
                        </Text>
                        <Text style={styles.modalLine}>💸 Ставка: {selectedShift?.hourly_rate ?? 0} ₽/ч</Text>
                        <Text style={styles.modalLine}>☕ Перерыв: {selectedShift?.break ?? 0} мин</Text>
                        <Text style={styles.modalLine}>➕ Доплата: {selectedShift?.extra_payment ?? 0} ₽</Text>
                        <Text style={styles.modalEarnings}>Итого: {selectedShift ? shiftTotal(selectedShift).toFixed(2) : '0.00'} ₽</Text>
                        {!!selectedShift?.notes && (
                            <Text style={styles.modalNote}>📝 {selectedShift.notes}</Text>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.editButton]}
                                onPress={() => {
                                    if (!selectedShift) return;
                                    const shiftId = String(selectedShift.id);
                                    setSelectedShift(null);
                                    router.push({
                                        pathname: '/(app)/shift-edit',
                                        params: { shiftId },
                                    });
                                }}
                            >
                                <Text style={styles.actionText}>Редактировать</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={handleDeleteShift}
                            >
                                <Text style={styles.actionText}>Удалить</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={isMonthPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsMonthPickerVisible(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setIsMonthPickerVisible(false)}>
                    <Pressable style={styles.monthPickerCard} onPress={() => {}}>
                        <Text style={styles.monthPickerTitle}>Выберите месяц</Text>
                        <FlatList
                            data={availableMonths}
                            keyExtractor={(item) => format(item, 'yyyy-MM')}
                            style={styles.monthPickerList}
                            renderItem={({ item }) => {
                                const isActive = format(item, 'yyyy-MM') === format(selectedMonthStart, 'yyyy-MM');
                                return (
                                    <TouchableOpacity
                                        style={[styles.monthItem, isActive && styles.monthItemActive]}
                                        onPress={() => {
                                            const direction = item.getTime() >= selectedMonthStart.getTime() ? 1 : -1;
                                            applyMonthSelection(item, direction);
                                            setIsMonthPickerVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.monthItemText, isActive && styles.monthItemTextActive]}>
                                            {format(item, 'LLLL yyyy', { locale: ru })}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const createStyles = () => StyleSheet.create({
    syncBadge: {
        position: 'absolute',
        bottom: 86, // Чуть выше плюсика (56 высота + 20 отступ + 10)
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        borderWidth: 1,
    },
    syncBadgePending: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    syncBadgeError: {
        backgroundColor: Colors.lightError,
        borderColor: Colors.error,
    },
    syncBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.darkGray,
        marginRight: 8,
    },
    syncBadgeButton: {
        paddingHorizontal: 4,
    },
    syncBadgeIcon: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primary,
    },

    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: Colors.primary,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: Colors.white,
        borderRadius: 14,
        padding: 18,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 10,
    },
    modalLine: {
        fontSize: 15,
        color: Colors.darkGray,
        marginBottom: 6,
    },
    modalEarnings: {
        marginTop: 6,
        fontSize: 20,
        fontWeight: '700',
        color: Colors.primary,
    },
    modalNote: {
        marginTop: 10,
        fontSize: 14,
        color: Colors.gray,
        fontStyle: 'italic',
    },
    modalActions: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
    },
    actionButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    editButton: {
        backgroundColor: Colors.primary,
    },
    deleteButton: {
        backgroundColor: Colors.error,
    },
    actionText: {
        color: Colors.onPrimary,
        fontWeight: '600',
    },
    monthHeaderButton: {
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: Colors.lightPrimary,
    },
    monthHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.primary,
        textTransform: 'capitalize',
    },
    monthHeaderHint: {
        marginTop: 2,
        fontSize: 11,
        color: Colors.gray,
    },
    monthPickerCard: {
        backgroundColor: Colors.white,
        borderRadius: 14,
        padding: 16,
        maxHeight: '72%',
    },
    monthPickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 12,
    },
    monthPickerList: {
        minWidth: 280,
    },
    monthItem: {
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        backgroundColor: Colors.lightGray,
    },
    monthItemActive: {
        backgroundColor: Colors.lightPrimary,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    monthItemText: {
        fontSize: 15,
        color: Colors.darkGray,
        textTransform: 'capitalize',
    },
    monthItemTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
});
