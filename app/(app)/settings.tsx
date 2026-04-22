import React, { useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  View,
  Switch,
  Platform,
} from 'react-native';
import * as Haptics from '@/utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { BonusSettings, defaultBonusSettings, loadBonusSettings, saveBonusSettings } from '@/services/bonusSettings';
import { loadCachedProfile, saveCachedProfile } from '@/services/profileCache';
import { defaultTaxSettings, loadTaxSettings, saveTaxSettings, TaxSettings } from '@/services/taxSettings';
import { useTheme } from '@/hooks/useTheme';

const DEFAULT_ADVANCE_DAY = 26;
const DEFAULT_SALARY_DAY = 11;

interface ProfileForm {
  email: string;
  full_name: string;
  phone: string;
  default_hourly_rate: string;
  advance_day: string;
  salary_day: string;
  any_availability_bonus_amount: string;
}

const clampDay = (value: string, fallback: number) => String(Math.max(1, Math.min(31, parseInt(value, 10) || fallback)));

export default function SettingsScreen() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [form, setForm] = useState<ProfileForm>({
    email: '',
    full_name: '',
    phone: '',
    default_hourly_rate: '',
    advance_day: String(DEFAULT_ADVANCE_DAY),
    salary_day: String(DEFAULT_SALARY_DAY),
    any_availability_bonus_amount: '12000',
  });
  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(defaultBonusSettings);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
  const [showAdvancePicker, setShowAdvancePicker] = useState(false);
  const [showSalaryPicker, setShowSalaryPicker] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  useTheme();
  const styles = createStyles();

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      const cachedProfile = await loadCachedProfile(user.id);
      const { data, error } = await supabase
          .from('profiles')
          .select('email, full_name, phone, default_hourly_rate, advance_day, salary_day, any_availability_bonus_amount')
          .eq('id', user.id)
          .single();

      if (error) {
        setForm({
          email: cachedProfile.email ?? user.email ?? '',
          full_name: cachedProfile.full_name ?? '',
          phone: cachedProfile.phone ?? '',
          default_hourly_rate: cachedProfile.default_hourly_rate ? String(cachedProfile.default_hourly_rate) : '',
          advance_day: String(cachedProfile.advance_day ?? DEFAULT_ADVANCE_DAY),
          salary_day: String(cachedProfile.salary_day ?? DEFAULT_SALARY_DAY),
          any_availability_bonus_amount: String(cachedProfile.any_availability_bonus_amount ?? 12000),
        });
      } else {
        await saveCachedProfile(user.id, data || {});
        setForm({
          email: data?.email ?? user.email ?? '',
          full_name: data?.full_name ?? '',
          phone: data?.phone ?? '',
          default_hourly_rate: data?.default_hourly_rate ? String(data.default_hourly_rate) : '',
          advance_day: String(data?.advance_day ?? DEFAULT_ADVANCE_DAY),
          salary_day: String(data?.salary_day ?? DEFAULT_SALARY_DAY),
          any_availability_bonus_amount: String(data?.any_availability_bonus_amount ?? 12000),
        });
      }

      const [loadedBonusSettings, loadedTaxSettings] = await Promise.all([
        loadBonusSettings(),
        loadTaxSettings(),
      ]);
      setBonusSettings(loadedBonusSettings);
      setTaxSettings(loadedTaxSettings);
      setHapticsEnabled(Haptics.getHapticsEnabled());
      setLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const normalizedEmail = form.email.trim().toLowerCase();
    const parsedAdvanceDay = parseInt(clampDay(form.advance_day, DEFAULT_ADVANCE_DAY), 10);
    const parsedSalaryDay = parseInt(clampDay(form.salary_day, DEFAULT_SALARY_DAY), 10);
    const parsedAnyAvailabilityBonusAmount = Math.max(0, parseFloat(form.any_availability_bonus_amount) || 0);

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert('Ошибка', 'Введите корректный email');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const profileData = {
        email: normalizedEmail,
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        default_hourly_rate: form.default_hourly_rate.trim() ? parseFloat(form.default_hourly_rate) : null,
        advance_day: parsedAdvanceDay,
        salary_day: parsedSalaryDay,
        any_availability_bonus_amount: parsedAnyAvailabilityBonusAmount,
        updated_at: new Date().toISOString(),
      };

      await saveCachedProfile(user.id, profileData);

      await Promise.all([
        saveBonusSettings(bonusSettings),
        saveTaxSettings(taxSettings),
        Haptics.setHapticsEnabled(hapticsEnabled),
      ]);

      let isOffline = false;
      try {
        if (normalizedEmail !== (user.email ?? '').toLowerCase()) {
          const { error: updateUserError } = await supabase.auth.updateUser({ email: normalizedEmail });
          if (updateUserError) throw updateUserError;
        }

        const { error } = await supabase
            .from('profiles')
            .upsert(
                { id: user.id, ...profileData },
                { onConflict: 'id' }
            );

        if (error) throw error;
      } catch (networkError: any) {
        if (networkError.message?.includes('Network request failed') || networkError.message?.includes('Failed to fetch')) {
          isOffline = true;
        } else {
          throw networkError;
        }
      }

      if (isOffline) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
            'Сохранено локально',
            'Нет подключения к сети. Настройки сохранены на устройстве.',
            [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Успешно', 'Настройки сохранены', [{ text: 'OK', onPress: () => router.back() }]);
      }

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const pickerDateFromDay = (dayValue: string) => {
    const day = Math.max(1, Math.min(31, parseInt(dayValue, 10) || 1));
    return new Date(2026, 0, day);
  };

  const handleDayChange = (field: 'advance_day' | 'salary_day', date?: Date) => {
    if (Platform.OS === 'android') {
      if (field === 'advance_day') setShowAdvancePicker(false);
      if (field === 'salary_day') setShowSalaryPicker(false);
    }

    if (!date) return;

    setForm((prev) => ({
      ...prev,
      [field]: String(date.getDate()),
    }));
  };

  if (loading) {
    return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );
  }

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Настройки</Text>
        </View>

        {/* Карточка: Личные данные */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Личные данные</Text>

          <Text style={styles.label}>Имя</Text>
          <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
              placeholder="Введите имя"
              placeholderTextColor={Colors.gray}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
              placeholder="example@mail.ru"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={Colors.gray}
          />

          <Text style={styles.label}>Ставка по умолчанию (₽/ч)</Text>
          <TextInput
              style={styles.input}
              value={form.default_hourly_rate}
              onChangeText={(value) => setForm((prev) => ({ ...prev, default_hourly_rate: value }))}
              placeholder="500"
              keyboardType="numeric"
              placeholderTextColor={Colors.gray}
          />
          <Text style={styles.hintText}>Подставляется автоматически при добавлении новой смены.</Text>
        </View>

        {/* Карточка: Системные настройки */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Система и расчеты</Text>

          <View style={[styles.row, styles.firstRow]}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Вибрация и отклик</Text>
              <Text style={styles.rowDescription}>Тактильная отдача при нажатиях и успешных действиях</Text>
            </View>
            <Switch
                value={hapticsEnabled}
                onValueChange={(val) => {
                  setHapticsEnabled(val);
                  if (val) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                thumbColor={hapticsEnabled ? Colors.white : Colors.white}
                trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Учитывать НДФЛ 13%</Text>
              <Text style={styles.rowDescription}>Если включено, во всем приложении доход будет показываться уже за вычетом налога</Text>
            </View>
            <Switch
                value={taxSettings.includeNdfl}
                onValueChange={(value) => {
                  setTaxSettings((prev) => ({ ...prev, includeNdfl: value }));
                  if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                thumbColor={taxSettings.includeNdfl ? Colors.white : Colors.white}
                trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
        </View>

        {/* Карточка: Настройки сети Вкусно и Точка */}
        <View style={styles.card}>
          <View style={[styles.row, styles.firstRow]}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Работник «Вкусно — и точка»</Text>
              <Text style={styles.rowDescription}>Активирует специальный алгоритм премий и выплат в разделе Статистики</Text>
            </View>
            <Switch
                value={bonusSettings.isVkusnoWorker}
                onValueChange={(value) => {
                  setBonusSettings((prev) => ({ ...prev, isVkusnoWorker: value }));
                  if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                thumbColor={bonusSettings.isVkusnoWorker ? Colors.white : Colors.white}
                trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>

          {bonusSettings.isVkusnoWorker && (
              <View style={styles.expandedSection}>
                <View style={styles.row}>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>Премия за гибкость</Text>
                    <Text style={styles.rowDescription}>Фиксированная доплата при выборе "любых временных возможностей"</Text>
                  </View>
                  <Switch
                      value={bonusSettings.anyAvailabilityBonusEnabled}
                      onValueChange={(value) => {
                        setBonusSettings((prev) => ({ ...prev, anyAvailabilityBonusEnabled: value }));
                        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      thumbColor={bonusSettings.anyAvailabilityBonusEnabled ? Colors.white : Colors.white}
                      trackColor={{ false: Colors.border, true: Colors.primary }}
                  />
                </View>

                {bonusSettings.anyAvailabilityBonusEnabled && (
                    <View style={styles.subInputWrap}>
                      <Text style={styles.label}>Сумма премии (₽)</Text>
                      <TextInput
                          style={styles.input}
                          value={form.any_availability_bonus_amount}
                          onChangeText={(value) => setForm((prev) => ({ ...prev, any_availability_bonus_amount: value }))}
                          placeholder="12000"
                          keyboardType="numeric"
                          placeholderTextColor={Colors.gray}
                      />
                    </View>
                )}

                <View style={styles.row}>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>Надбавка за норму часов</Text>
                    <Text style={styles.rowDescription}>Если отработано больше 120 часов, добавляет +100 ₽ к каждому часу</Text>
                  </View>
                  <Switch
                      value={bonusSettings.hourlyRateBonusEnabled}
                      onValueChange={(value) => {
                        setBonusSettings((prev) => ({ ...prev, hourlyRateBonusEnabled: value }));
                        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      thumbColor={bonusSettings.hourlyRateBonusEnabled ? Colors.white : Colors.white}
                      trackColor={{ false: Colors.border, true: Colors.primary }}
                  />
                </View>

                <View style={styles.payrollSection}>
                  <Text style={styles.label}>Число аванса</Text>
                  <TouchableOpacity style={styles.dayPickerButton} onPress={() => setShowAdvancePicker(true)} activeOpacity={0.7}>
                    <Text style={styles.dayPickerValue}>{clampDay(form.advance_day, DEFAULT_ADVANCE_DAY)}</Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, {marginTop: 16}]}>Число зарплаты</Text>
                  <TouchableOpacity style={styles.dayPickerButton} onPress={() => setShowSalaryPicker(true)} activeOpacity={0.7}>
                    <Text style={styles.dayPickerValue}>{clampDay(form.salary_day, DEFAULT_SALARY_DAY)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.hintText}>Даты используются для расчета выплат в статистике.</Text>

                  {showAdvancePicker && (
                      <DateTimePicker
                          value={pickerDateFromDay(form.advance_day)}
                          mode="date"
                          display="default"
                          onChange={(_event, date) => handleDayChange('advance_day', date)}
                      />
                  )}

                  {showSalaryPicker && (
                      <DateTimePicker
                          value={pickerDateFromDay(form.salary_day)}
                          mode="date"
                          display="default"
                          onChange={(_event, date) => handleDayChange('salary_day', date)}
                      />
                  )}
                </View>
              </View>
          )}
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.saveButtonText}>Сохранить изменения</Text>}
        </TouchableOpacity>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    paddingBottom: 40
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: Colors.lightGray,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  hintText: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.gray,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 16
  },
  firstRow: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 16
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray
  },
  rowDescription: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.gray,
    lineHeight: 18,
  },
  expandedSection: {
    marginTop: 8,
  },
  subInputWrap: {
    marginBottom: 16,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  payrollSection: {
    marginTop: 8,
    backgroundColor: Colors.lightGray,
    padding: 16,
    borderRadius: 16,
  },
  dayPickerButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  dayPickerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray
  },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 8,
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
  saveButtonDisabled: {
    backgroundColor: Colors.gray,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
});