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
    RefreshControl,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as Haptics from '@/utils/haptics';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { addMonths, format, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import ShiftCard from '@/components/ShiftCard';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { applyNdfl, calculateEarnings } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { loadHolidayDateSet } from '@/services/holidays';
import { defaultTaxSettings, loadTaxSettings } from '@/services/taxSettings';
import { deleteShiftOfflineAware, getShiftsWithOffline, getCachedShifts, saveShiftOfflineAware } from '@/services/offlineShifts';
import { useShiftSyncStatus } from '@/hooks/useShiftSyncStatus';
import { syncNow } from '@/services/offlineSync';
import SmartScannerButton from '@/components/SmartScannerButton';
import ShiftSkeleton from '@/components/ShiftSkeleton';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeIn } from 'react-native-reanimated';

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

const formatMoney = (amount: number) => {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
    const [refreshing, setRefreshing] = useState(false);
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

            const [cachedShifts, holidays, taxSettings] = await Promise.all([
                getCachedShifts(user.id),
                loadHolidayDateSet(),
                loadTaxSettings(),
            ]);

            const localRange = cachedShifts.filter((s) => s.date >= start && s.date <= end);
            setShifts(localRange as Shift[]);
            setHolidayDateSet(holidays);
            setIncludeNdfl(taxSettings.includeNdfl);

            const shiftPayload = await getShiftsWithOffline({ userId: user.id, start, end });
            setShifts((shiftPayload.shifts as Shift[]) ?? []);
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

    const onRefresh = useCallback(async () => {
        if (!user) return;
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const result = await syncNow(user.id, { forceRefreshCache: true });
            await fetchShifts();

            if (result.status === 'error') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setRefreshing(false);
        }
    }, [user, fetchShifts]);

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
                    elevation: 2,
                    shadowColor: Colors.secondary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 3,
                },
                text: {
                    color: Colors.onPrimary,
                    fontWeight: "800",
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

    const handleDeleteShift = (shiftToDelete: Shift) => {
        Alert.alert('Удалить смену', 'Вы уверены, что хотите удалить эту смену?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const result = await deleteShiftOfflineAware({
                            userId: user?.id || '',
                            shiftId: shiftToDelete.id,
                        });

                        setSelectedShift(null);
                        if (result.queued) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert('Офлайн режим', 'Удаление сохранено локально и отправится при появлении интернета.');
                        } else {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                        if (user?.id) {
                            await syncNextShiftWidgetForUser(user.id);
                        }
                        await fetchShifts();
                    } catch (error: any) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Alert.alert('Ошибка', error.message || 'Не удалось удалить смену');
                    }
                },
            },
        ]);
    };

    const handleDuplicateShift = async () => {
        if (!selectedShift || !user) return;

        try {
            const nextDate = format(addDays(new Date(selectedShift.date), 1), 'yyyy-MM-dd');

            const start = selectedShift.start_time?.split(':').slice(0, 2).join(':');
            const end = selectedShift.end_time?.split(':').slice(0, 2).join(':');
            const earnings = calculateEarnings(
                start,
                end,
                selectedShift.hourly_rate ?? 0,
                selectedShift.extra_payment ?? 0,
                selectedShift.break ?? 0
            );

            const shiftData = {
                user_id: user.id,
                date: nextDate,
                start_time: selectedShift.start_time,
                end_time: selectedShift.end_time,
                hourly_rate: selectedShift.hourly_rate,
                extra_payment: selectedShift.extra_payment,
                break: selectedShift.break,
                notes: selectedShift.notes,
                earnings: earnings,
            };

            const result = await saveShiftOfflineAware({
                userId: user.id,
                isEdit: false,
                shiftData,
            });

            setSelectedShift(null);

            if (result.queued) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Офлайн', 'Смена скопирована на завтра и сохранится на сервере при появлении сети.');
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setSelectedDate(new Date(nextDate));
            if (user?.id) {
                await syncNextShiftWidgetForUser(user.id);
            }
            await fetchShifts();

        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Ошибка', error.message || 'Не удалось скопировать смену');
        }
    };

    const handleMonthChange = (monthDate: Date) => {
        const diffDirection = monthDate.getTime() >= selectedMonthStart.getTime() ? 1 : -1;
        applyMonthSelection(monthDate, diffDirection);
    };

    return (
        <View style={styles.background}>


            <FlatList
                data={filteredShifts}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <>
                        <View style={styles.calendarWrapper}>
                            <Animated.View
                                style={{
                                    opacity: calendarOpacity,
                                    transform: [{ translateX: calendarTranslateX }],
                                }}
                            >
                                <Calendar
                                    key={calendarKey}
                                    current={formattedDate}
                                    onDayPress={(day: { dateString: string }) => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setSelectedDate(new Date(day.dateString));
                                    }}
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
                                            <Text style={styles.monthHeaderHint}>Нажмите для выбора</Text>
                                        </TouchableOpacity>
                                    )}
                                    theme={{
                                        calendarBackground: Colors.white,
                                        selectedDayBackgroundColor: Colors.secondary,
                                        todayTextColor: Colors.primary,
                                        dayTextColor: Colors.darkGray,
                                        monthTextColor: Colors.primary,
                                        arrowColor: Colors.primary,
                                        textDayFontWeight: '500',
                                        textMonthFontWeight: 'bold',
                                        textDayHeaderFontWeight: '600',
                                    }}
                                    firstDay={1}
                                    enableSwipeMonths
                                    markingType="custom"
                                />
                            </Animated.View>
                        </View>

                        <View style={styles.dailySummaryCard}>
                            <View>
                                <Text style={styles.dailySummaryDate}>
                                    {format(selectedDate, 'dd MMMM', { locale: ru })}
                                </Text>
                                <Text style={styles.dailySummaryYear}>
                                    {format(selectedDate, 'yyyy', { locale: ru })}
                                </Text>
                            </View>
                            <View style={styles.dailySummaryEarningsContainer}>
                                <Text style={styles.dailySummaryLabel}>За день</Text>
                                <Text style={styles.dailySummaryValue}>
                                    {formatMoney(dayEarnings)} ₽
                                </Text>
                            </View>
                        </View>
                    </>
                }
                renderItem={({ item }) => (
                    <View style={styles.shiftCardContainer}>
                        <ShiftCard
                            shift={item}
                            onPress={() => setSelectedShift(item)}
                            onEdit={() => {
                                router.push({
                                    pathname: '/(app)/shift-edit',
                                    params: { shiftId: String(item.id) },
                                });
                            }}
                            onDelete={() => handleDeleteShift(item)}
                        />
                    </View>
                )}
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.shiftCardContainer}>
                            <ShiftSkeleton />
                            <ShiftSkeleton />
                            <ShiftSkeleton />
                        </View>
                    ) : (
                        <Reanimated.View
                            entering={FadeIn.duration(400).delay(100)}
                            style={styles.emptyContainer}
                        >
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="cafe-outline" size={36} color={Colors.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>Свободный день</Text>
                            <Text style={styles.emptySubtitle}>
                                На эту дату смен не найдено.{'\n'}Отдыхайте или добавьте новую смену.
                            </Text>
                        </Reanimated.View>
                    )
                }
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
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
                        onPress={async () => {
                            if (!user?.id) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const result = await syncNow(user.id, { forceRefreshCache: true });
                            await fetchShifts();

                            if (result.status === 'error') {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            } else {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        }}
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
                <Text style={styles.fabText}>+</Text>
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
                                ? `Смена ${format(new Date(`${selectedShift.date}T00:00:00`), 'd MMMM yyyy', { locale: ru })}`
                                : 'Смена'}
                        </Text>
                        <Text style={styles.modalLine}>
                            ⏰ {selectedShift?.start_time?.split(':').slice(0, 2).join(':')} — {selectedShift?.end_time?.split(':').slice(0, 2).join(':')}
                        </Text>
                        <Text style={styles.modalLine}>💸 Ставка: {selectedShift?.hourly_rate ?? 0} ₽/ч</Text>
                        <Text style={styles.modalLine}>☕ Перерыв: {selectedShift?.break ?? 0} мин</Text>
                        <Text style={styles.modalLine}>➕ Доплата: {selectedShift?.extra_payment ?? 0} ₽</Text>
                        <View style={styles.modalDivider} />
                        <Text style={styles.modalEarnings}>Итого: {selectedShift ? formatMoney(shiftTotal(selectedShift)) : '0.00'} ₽</Text>
                        {!!selectedShift?.notes && (
                            <Text style={styles.modalNote}>📝 {selectedShift.notes}</Text>
                        )}

                        <View style={styles.modalActionsContainer}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.duplicateButton]}
                                onPress={handleDuplicateShift}
                            >
                                <Ionicons name="copy-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.duplicateButtonText}>Скопировать на завтра</Text>
                            </TouchableOpacity>

                            <View style={styles.modalActionsRow}>
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
                                    onPress={() => selectedShift && handleDeleteShift(selectedShift)}
                                >
                                    <Text style={styles.actionText}>Удалить</Text>
                                </TouchableOpacity>
                            </View>
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

            <View style={styles.floatingButtonContainer}>
                <SmartScannerButton />
            </View>
        </View>
    );
}

const createStyles = () => StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: Colors.background,
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
    listContent: {
        paddingBottom: 120,
    },
    calendarWrapper: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 20,
        paddingBottom: 10,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden',
    },
    dailySummaryCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: Colors.white,
        borderRadius: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    dailySummaryDate: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.darkGray,
        textTransform: 'capitalize',
    },
    dailySummaryYear: {
        fontSize: 13,
        color: Colors.gray,
        fontWeight: '500',
        marginTop: 2,
    },
    dailySummaryEarningsContainer: {
        alignItems: 'flex-end',
    },
    dailySummaryLabel: {
        fontSize: 12,
        color: Colors.gray,
        fontWeight: '500',
        marginBottom: 2,
    },
    dailySummaryValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.primary,
    },
    shiftCardContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    floatingButtonContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        zIndex: 100,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
        paddingBottom: 20,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.lightGray,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.gray,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 30,
    },
    syncBadge: {
        position: 'absolute',
        bottom: 96,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 4,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        borderWidth: 1,
    },
    syncBadgePending: {
        backgroundColor: Colors.white,
        borderColor: Colors.border,
    },
    syncBadgeError: {
        backgroundColor: Colors.lightError,
        borderColor: Colors.error,
    },
    syncBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray,
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
        bottom: 24,
        right: 20,
        backgroundColor: Colors.primary,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    fabText: {
        color: Colors.onPrimary,
        fontSize: 28,
        fontWeight: '600',
        marginTop: -2,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 24,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.darkGray,
        marginBottom: 16,
    },
    modalLine: {
        fontSize: 15,
        color: Colors.darkGray,
        fontWeight: '500',
        marginBottom: 8,
    },
    modalDivider: {
        height: 1,
        backgroundColor: Colors.border,
        opacity: 0.6,
        marginVertical: 12,
    },
    modalEarnings: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.primary,
    },
    modalNote: {
        marginTop: 12,
        fontSize: 14,
        color: Colors.gray,
        fontStyle: 'italic',
        backgroundColor: Colors.lightGray,
        padding: 10,
        borderRadius: 8,
    },
    modalActionsContainer: {
        marginTop: 24,
        gap: 12,
    },
    modalActionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    editButton: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    deleteButton: {
        flex: 1,
        backgroundColor: Colors.lightError,
    },
    duplicateButton: {
        backgroundColor: Colors.lightPrimary,
        width: '100%',
    },
    duplicateButtonText: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 15,
    },
    actionText: {
        color: Colors.onPrimary,
        fontWeight: '700',
        fontSize: 15,
    },
    monthHeaderButton: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: Colors.lightPrimary,
    },
    monthHeaderText: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.primary,
        textTransform: 'capitalize',
    },
    monthHeaderHint: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '500',
        color: Colors.primary,
        opacity: 0.7,
    },
    monthPickerCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 20,
        maxHeight: '75%',
    },
    monthPickerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.darkGray,
        marginBottom: 16,
    },
    monthPickerList: {
        minWidth: 280,
    },
    monthItem: {
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 8,
        backgroundColor: Colors.lightGray,
    },
    monthItemActive: {
        backgroundColor: Colors.lightPrimary,
    },
    monthItemText: {
        fontSize: 16,
        color: Colors.darkGray,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    monthItemTextActive: {
        color: Colors.primary,
        fontWeight: '800',
    },
});