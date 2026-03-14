import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { applyNdfl, calculateEarnings } from '@/utils/calculations';
import { ShiftTemplate, getAllShiftTemplates } from '@/services/shiftTemplates';
import { loadHolidayDateSet } from '@/services/holidays';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { defaultBonusSettings, loadBonusSettings } from '@/services/bonusSettings';
import { defaultTaxSettings, loadTaxSettings } from '@/services/taxSettings';
import { deleteShiftOfflineAware, getShiftByIdOffline, saveShiftOfflineAware } from '@/services/offlineShifts';

type ShiftEntity = {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    extra_payment: number;
    notes?: string | null;
    break?: number | null;
};

const getSingleParam = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) return value[0];
    return value;
};

const normalizeTime = (time: string) => time.split(':').slice(0, 2).join(':');
const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
const HOLIDAY_SHIFT_BONUS = 50;

const formatTimeInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export default function ShiftEditScreen() {
    const params = useLocalSearchParams();
    const shiftId = getSingleParam(params.shiftId as string | string[] | undefined);
    const dateParam = getSingleParam(params.date as string | string[] | undefined);

    const isEdit = !!shiftId;

    const [formData, setFormData] = useState({
        date: dateParam || format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        hourlyRate: '500',
        extraPayment: '0',
        breakMinutes: '0',
        notes: '',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [screenLoading, setScreenLoading] = useState(false);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [holidayDateSet, setHolidayDateSet] = useState<Set<string>>(new Set());
    const [bonusSystemEnabled, setBonusSystemEnabled] = useState(defaultBonusSettings.bonusSystemEnabled);
    const [includeNdfl, setIncludeNdfl] = useState(defaultTaxSettings.includeNdfl);
    const router = useRouter();
    const { user } = useAuth();

    const bootstrap = useCallback(async () => {
        if (!user) return;

        setScreenLoading(true);
        try {
            if (shiftId) {
                let loadedShift: ShiftEntity | null = null;

                try {
                    const { data, error } = await supabase
                        .from('shifts')
                        .select('*')
                        .eq('id', shiftId)
                        .eq('user_id', user.id)
                        .single();

                    if (error) throw error;
                    loadedShift = data as ShiftEntity;
                } catch {
                    loadedShift = await getShiftByIdOffline(user.id, shiftId) as ShiftEntity | null;
                }

                if (!loadedShift) {
                    throw new Error('Не удалось загрузить смену (нет интернета и кэша).');
                }

                setFormData({
                    date: loadedShift.date,
                    startTime: normalizeTime(loadedShift.start_time),
                    endTime: normalizeTime(loadedShift.end_time),
                    hourlyRate: String(loadedShift.hourly_rate ?? 0),
                    extraPayment: String(loadedShift.extra_payment ?? 0),
                    breakMinutes: String(loadedShift.break ?? 0),
                    notes: loadedShift.notes ?? '',
                });
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('default_hourly_rate')
                .eq('id', user.id)
                .single();

            setFormData((prev) => ({
                ...prev,
                date: dateParam || format(new Date(), 'yyyy-MM-dd'),
                hourlyRate: profile?.default_hourly_rate
                    ? String(profile.default_hourly_rate)
                    : prev.hourlyRate,
            }));
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось загрузить данные смены');
            if (shiftId) {
                router.back();
            }
        } finally {
            setScreenLoading(false);
        }
    }, [dateParam, router, shiftId, user]);

    useFocusEffect(
        useCallback(() => {
            bootstrap();
        }, [bootstrap])
    );

    useFocusEffect(
        useCallback(() => {
            let mounted = true;

            const loadTemplates = async () => {
                const [templates, holidays, bonusSettings, taxSettings] = await Promise.all([
                    getAllShiftTemplates(user?.id),
                    loadHolidayDateSet(),
                    loadBonusSettings(),
                    loadTaxSettings(),
                ]);

                if (mounted) {
                    setShiftTemplates(templates);
                    setHolidayDateSet(holidays);
                    setBonusSystemEnabled(bonusSettings.bonusSystemEnabled);
                    setIncludeNdfl(taxSettings.includeNdfl);
                }
            };

            loadTemplates();

            return () => {
                mounted = false;
            };
        }, [user])
    );

    const grossEarnings = useMemo(() => {
        if (!isValidTime(formData.startTime) || !isValidTime(formData.endTime)) {
            return 0;
        }

        const hourlyRate = parseFloat(formData.hourlyRate) || 0;
        const extra = parseFloat(formData.extraPayment) || 0;
        const breakMinutes = Math.min(120, Math.max(0, parseInt(formData.breakMinutes || '0', 10) || 0));
        return calculateEarnings(formData.startTime, formData.endTime, hourlyRate, extra, breakMinutes);
    }, [formData.breakMinutes, formData.endTime, formData.extraPayment, formData.hourlyRate, formData.startTime]);

    const isHolidayShift = holidayDateSet.has(formData.date);
    const holidayPremium = isHolidayShift
        ? grossEarnings + (bonusSystemEnabled ? HOLIDAY_SHIFT_BONUS : 0)
        : 0;
    const totalWithHoliday = applyNdfl(grossEarnings + holidayPremium, includeNdfl);

    const handleSave = async () => {
        if (!formData.date || !formData.startTime || !formData.endTime || !formData.hourlyRate) {
            Alert.alert('Ошибка', 'Заполните все обязательные поля');
            return;
        }

        if (!isValidTime(formData.startTime) || !isValidTime(formData.endTime)) {
            Alert.alert('Ошибка', 'Время начала и окончания должно быть в формате ЧЧ:ММ');
            return;
        }

        setLoading(true);
        try {
            if (!user) throw new Error('Пользователь не найден');

            const breakMinutes = Math.min(120, Math.max(0, parseInt(formData.breakMinutes || '0', 10) || 0));

            const shiftData = {
                user_id: user.id,
                date: formData.date,
                start_time: formData.startTime,
                end_time: formData.endTime,
                hourly_rate: parseFloat(formData.hourlyRate),
                extra_payment: parseFloat(formData.extraPayment) || 0,
                break: breakMinutes,
                notes: formData.notes,
            };

            const result = await saveShiftOfflineAware({
                userId: user.id,
                isEdit,
                shiftId,
                shiftData: {
                    ...shiftData,
                    earnings: grossEarnings,
                },
            });

            if (result.queued) {
                Alert.alert('Офлайн режим', isEdit
                    ? 'Изменения сохранены локально и отправятся при появлении интернета.'
                    : 'Смена сохранена локально и отправится при появлении интернета.');
            } else {
                Alert.alert('Успешно', isEdit ? 'Смена обновлена' : 'Смена добавлена');
            }

            await syncNextShiftWidgetForUser(user.id);
            router.back();
        } catch (error: any) {
            Alert.alert('Ошибка', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (!shiftId || !user) return;

        Alert.alert(
            'Удалить смену',
            'Вы уверены, что хотите удалить эту смену?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await deleteShiftOfflineAware({ userId: user.id, shiftId });
                            if (result.queued) {
                                Alert.alert('Офлайн режим', 'Удаление сохранено локально и отправится при появлении интернета.');
                            }
                            await syncNextShiftWidgetForUser(user.id);
                            router.back();
                        } catch (error: any) {
                            Alert.alert('Ошибка', error.message);
                        }
                    },
                },
            ],
        );
    };

    const onDateChange = (_event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }

        if (selectedDate) {
            setFormData((prev) => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
        }
    };



    if (screenLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
                <Text style={{ color: Colors.gray }}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Дата*
                </Text>
                <TouchableOpacity
                    style={{ padding: 12, backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={{ fontSize: 16, color: Colors.darkGray }}>
                        {format(new Date(`${formData.date}T00:00:00`), 'dd.MM.yyyy')}
                    </Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={new Date(`${formData.date}T00:00:00`)}
                        mode="date"
                        onChange={onDateChange}
                    />
                )}

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Время начала*
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.darkGray }}
                    value={formData.startTime}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, startTime: formatTimeInput(text) }))}
                    keyboardType="number-pad"
                    placeholder="09:00"
                    placeholderTextColor={Colors.gray}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Время окончания*
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.darkGray }}
                    value={formData.endTime}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, endTime: formatTimeInput(text) }))}
                    keyboardType="number-pad"
                    placeholder="17:00"
                    placeholderTextColor={Colors.gray}
                />
                <Text style={{ marginTop: 6, fontSize: 12, color: Colors.gray }}>Формат времени: ЧЧ:ММ (например 09:30).</Text>

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Шаблоны смен
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
                    {shiftTemplates.map((preset) => (
                        <TouchableOpacity
                            key={preset.id}
                            style={{
                                backgroundColor: Colors.white,
                                borderWidth: 1,
                                borderColor: Colors.border,
                                borderRadius: 20,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                marginRight: 8,
                            }}
                            onPress={() => setFormData((prev) => ({
                                ...prev,
                                startTime: preset.startTime,
                                endTime: preset.endTime,
                                breakMinutes: String(preset.breakMinutes),
                            }))}
                        >
                            <Text style={{ color: Colors.darkGray, fontSize: 13 }}>{preset.name} {preset.startTime}–{preset.endTime}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Ставка в час (₽)*
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.darkGray }}
                    value={formData.hourlyRate}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, hourlyRate: text }))}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={Colors.gray}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Дополнительные выплаты (₽)
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.darkGray }}
                    value={formData.extraPayment}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, extraPayment: text }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.gray}
                />

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Перерыв (минуты)
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: Colors.darkGray }}
                    value={formData.breakMinutes}
                    onChangeText={(text) => {
                        const digitsOnly = text.replace(/[^0-9]/g, '');
                        if (!digitsOnly) {
                            setFormData((prev) => ({ ...prev, breakMinutes: '0' }));
                            return;
                        }

                        const parsed = Math.min(120, Math.max(0, parseInt(digitsOnly, 10)));
                        setFormData((prev) => ({ ...prev, breakMinutes: String(parsed) }));
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.gray}
                />
                <Text style={{ marginTop: 6, fontSize: 12, color: Colors.gray }}>Максимум 120 минут (2 часа). Перерыв не оплачивается.</Text>

                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 16 }}>
                    Примечания
                </Text>
                <TextInput
                    style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80, textAlignVertical: 'top', color: Colors.darkGray }}
                    value={formData.notes}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                    placeholder="Дополнительная информация"
                    placeholderTextColor={Colors.gray}
                    multiline
                    numberOfLines={3}
                />

                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: Colors.lightPrimary,
                        padding: 16,
                        borderRadius: 8,
                        marginTop: 24,
                        marginBottom: 20,
                    }}
                >
                    <Text style={{ fontSize: 16, color: Colors.darkGray, fontWeight: '600' }}>Заработок:</Text>
                    <Text style={{ fontSize: 20, color: Colors.primary, fontWeight: 'bold' }}>
                        {applyNdfl(grossEarnings, includeNdfl).toFixed(2)} ₽
                    </Text>
                </View>

                {isHolidayShift && (
                    <View style={{ backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                        <Text style={{ color: Colors.darkGray, fontSize: 14, fontWeight: '600' }}>🎉 Праздничный день: действует двойная ставка</Text>
                        <Text style={{ color: Colors.gray, fontSize: 13, marginTop: 6 }}>
                            Доплата за двойную ставку: +{holidayPremium.toFixed(2)} ₽
                            {bonusSystemEnabled ? ' (включая +50 ₽ за праздничную смену)' : ''}
                        </Text>
                        <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '700', marginTop: 6 }}>Итого с двойной ставкой: {totalWithHoliday.toFixed(2)} ₽</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={{ backgroundColor: loading ? Colors.gray : Colors.primary, padding: 16, borderRadius: 8, alignItems: 'center' }}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={{ color: Colors.onPrimary, fontSize: 16, fontWeight: '600' }}>
                        {loading ? 'Сохранение...' : isEdit ? 'Обновить' : 'Сохранить'}
                    </Text>
                </TouchableOpacity>

                {isEdit && (
                    <TouchableOpacity
                        style={{ padding: 16, alignItems: 'center', marginTop: 12 }}
                        onPress={handleDelete}
                        disabled={loading}
                    >
                        <Text style={{ color: Colors.error, fontSize: 16 }}>Удалить смену</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}
