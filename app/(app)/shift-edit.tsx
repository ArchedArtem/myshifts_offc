import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    StyleSheet,
} from 'react-native';
import * as Haptics from '@/utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { applyNdfl, calculateEarnings } from '@/utils/calculations';
import { loadCachedProfile, saveCachedProfile } from '@/services/profileCache';
import { ShiftTemplate, getAllShiftTemplates } from '@/services/shiftTemplates';
import { loadHolidayDateSet } from '@/services/holidays';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { defaultTaxSettings, loadTaxSettings } from '@/services/taxSettings';
import { deleteShiftOfflineAware, getShiftByIdOffline, saveShiftOfflineAware } from '@/services/offlineShifts';
import { useTheme } from '@/hooks/useTheme';

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

const formatTimeInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export default function ShiftEditScreen() {
    useTheme();
    const styles = createStyles();

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

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('default_hourly_rate')
                    .eq('id', user.id)
                    .single();

                await saveCachedProfile(user.id, profile || {});
                setFormData((prev) => ({
                    ...prev,
                    date: dateParam || format(new Date(), 'yyyy-MM-dd'),
                    hourlyRate: profile?.default_hourly_rate
                        ? String(profile.default_hourly_rate)
                        : prev.hourlyRate,
                }));
            } catch {
                const cachedProfile = await loadCachedProfile(user.id);
                setFormData((prev) => ({
                    ...prev,
                    date: dateParam || format(new Date(), 'yyyy-MM-dd'),
                    hourlyRate: cachedProfile.default_hourly_rate
                        ? String(cachedProfile.default_hourly_rate)
                        : prev.hourlyRate,
                }));
            }
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
                const [templates, holidays, taxSettings] = await Promise.all([
                    getAllShiftTemplates(user?.id),
                    loadHolidayDateSet(),
                    loadTaxSettings(),
                ]);

                if (mounted) {
                    setShiftTemplates(templates);
                    setHolidayDateSet(holidays);
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
    const holidayPremium = isHolidayShift ? grossEarnings : 0;
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Офлайн режим', isEdit
                    ? 'Изменения сохранены локально и отправятся при появлении интернета.'
                    : 'Смена сохранена локально и отправится при появлении интернета.');
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Успешно', isEdit ? 'Смена обновлена' : 'Смена добавлена');
            }

            await syncNextShiftWidgetForUser(user.id);
            router.back();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
            <View style={styles.loaderContainer}>
                <Text style={styles.loaderText}>Загрузка данных...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{isEdit ? 'Редактировать смену' : 'Новая смена'}</Text>
            </View>

            {/* Карточка: Дата и Шаблоны */}
            <View style={styles.card}>
                <Text style={styles.label}>Дата</Text>
                <TouchableOpacity style={styles.inputWrap} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                    <Text style={styles.inputText}>
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

                {shiftTemplates.length > 0 && (
                    <>
                        <Text style={[styles.label, { marginTop: 20 }]}>Быстрые шаблоны</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesScroll}>
                            {shiftTemplates.map((preset) => (
                                <TouchableOpacity
                                    key={preset.id}
                                    style={styles.templateButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setFormData((prev) => ({
                                            ...prev,
                                            startTime: preset.startTime,
                                            endTime: preset.endTime,
                                            breakMinutes: String(preset.breakMinutes),
                                        }));
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.templateButtonText}>
                                        {preset.name} {preset.startTime}–{preset.endTime}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                )}
            </View>

            {/* Карточка: Время */}
            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>Начало</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.startTime}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, startTime: formatTimeInput(text) }))}
                            keyboardType="number-pad"
                            placeholder="09:00"
                            placeholderTextColor={Colors.gray}
                        />
                    </View>
                    <View style={styles.halfWidth}>
                        <Text style={styles.label}>Окончание</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.endTime}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, endTime: formatTimeInput(text) }))}
                            keyboardType="number-pad"
                            placeholder="17:00"
                            placeholderTextColor={Colors.gray}
                        />
                    </View>
                </View>
                <Text style={styles.hintText}>Формат времени: ЧЧ:ММ (например 09:30)</Text>

                <Text style={[styles.label, { marginTop: 20 }]}>Перерыв (минуты)</Text>
                <TextInput
                    style={styles.input}
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
                <Text style={styles.hintText}>Максимум 120 минут. Перерыв вычитается из часов.</Text>
            </View>

            {/* Карточка: Деньги и Заметки */}
            <View style={styles.card}>
                <Text style={styles.label}>Ставка в час (₽)</Text>
                <TextInput
                    style={styles.input}
                    value={formData.hourlyRate}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, hourlyRate: text }))}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={Colors.gray}
                />

                <Text style={[styles.label, { marginTop: 20 }]}>Доплата за смену (₽)</Text>
                <TextInput
                    style={styles.input}
                    value={formData.extraPayment}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, extraPayment: text }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.gray}
                />

                <Text style={[styles.label, { marginTop: 20 }]}>Примечания</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.notes}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                    placeholder="Дополнительная информация (по желанию)"
                    placeholderTextColor={Colors.gray}
                    multiline
                    numberOfLines={3}
                />
            </View>

            <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Итого за смену</Text>
                <Text style={styles.totalValue}>
                    {applyNdfl(grossEarnings, includeNdfl).toFixed(2)} ₽
                </Text>
            </View>

            {isHolidayShift && (
                <View style={styles.holidayAlert}>
                    <Text style={styles.holidayAlertTitle}>🎉 Праздничный день: двойная ставка</Text>
                    <Text style={styles.holidayAlertText}>
                        Доплата: +{holidayPremium.toFixed(2)} ₽
                    </Text>
                    <Text style={styles.holidayAlertTotal}>
                        Итого с учетом праздника: {totalWithHoliday.toFixed(2)} ₽
                    </Text>
                </View>
            )}

            {/* Кнопки */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>
                        {loading ? 'Сохранение...' : isEdit ? 'Обновить смену' : 'Добавить смену'}
                    </Text>
                </TouchableOpacity>

                {isEdit && (
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDelete}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.deleteButtonText}>Удалить смену</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}

const createStyles = () => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
    },
    loaderText: {
        color: Colors.gray,
        fontSize: 16,
        fontWeight: '500',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.darkGray,
    },
    card: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 20,
        padding: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    label: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 8,
    },
    inputWrap: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputText: {
        fontSize: 16,
        color: Colors.darkGray,
        fontWeight: '500',
    },
    input: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: Colors.darkGray,
        fontWeight: '500',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    hintText: {
        marginTop: 6,
        fontSize: 13,
        color: Colors.gray,
        marginLeft: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    templatesScroll: {
        paddingBottom: 4,
        gap: 8,
    },
    templateButton: {
        backgroundColor: Colors.lightPrimary,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    templateButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    totalCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.lightPrimary,
        marginHorizontal: 16,
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 16,
        color: Colors.primary,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: 24,
        color: Colors.primary,
        fontWeight: '800',
    },
    holidayAlert: {
        backgroundColor: Colors.white,
        borderColor: Colors.border,
        borderWidth: 1,
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    holidayAlertTitle: {
        color: Colors.darkGray,
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 6,
    },
    holidayAlertText: {
        color: Colors.gray,
        fontSize: 14,
        marginBottom: 6,
    },
    holidayAlertTotal: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '800',
    },
    actionsContainer: {
        paddingHorizontal: 16,
        marginTop: 10,
        gap: 12,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonDisabled: {
        backgroundColor: Colors.gray,
        shadowOpacity: 0,
        elevation: 0,
    },
    primaryButtonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    deleteButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: Colors.error,
        fontSize: 15,
        fontWeight: '600',
    },
});