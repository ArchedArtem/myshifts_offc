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
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/services/supabase/client';
import ShiftCard from '@/components/ShiftCard';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { calculateEarnings } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { loadHolidayDateSet } from '@/services/holidays';


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

    const router = useRouter();
    const { user } = useAuth();
    useTheme();
    const styles = createStyles();

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    const fetchShifts = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

            const [{ data, error }, holidays] = await Promise.all([
                supabase
                    .from('shifts')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('date', start)
                    .lte('date', end)
                    .order('date', { ascending: false })
                    .order('start_time', { ascending: true }),
                loadHolidayDateSet(),
            ]);

            if (error) throw error;
            setShifts((data as Shift[]) ?? []);
            setHolidayDateSet(holidays);
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
        return total + calculateEarnings(start, end, shift.hourly_rate ?? 0, shift.extra_payment ?? 0, shift.break ?? 0);
    }, 0);

    const handleDeleteShift = () => {
        if (!selectedShift) return;

        Alert.alert('Удалить смену', 'Вы уверены, что хотите удалить эту смену?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('shifts')
                            .delete()
                            .eq('id', selectedShift.id)
                            .eq('user_id', user?.id);

                        if (error) throw error;

                        setSelectedShift(null);
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

    return (
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
            <Calendar
                current={formattedDate}
                onDayPress={(day: { dateString: string }) => setSelectedDate(new Date(day.dateString))}
                onMonthChange={(month: { dateString: string }) => setSelectedDate(new Date(month.dateString))}
                markedDates={markedDates}
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
                        <Text style={styles.modalEarnings}>Итого: {selectedShift ? calculateEarnings(
                            selectedShift.start_time?.split(':').slice(0, 2).join(':'),
                            selectedShift.end_time?.split(':').slice(0, 2).join(':'),
                            selectedShift.hourly_rate ?? 0,
                            selectedShift.extra_payment ?? 0,
                            selectedShift.break ?? 0,
                        ).toFixed(2) : '0.00'} ₽</Text>
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
        </View>
    );
}

const createStyles = () => StyleSheet.create({
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
});
