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
    try {
      if (normalizedEmail !== (user.email ?? '').toLowerCase()) {
        const { error: updateUserError } = await supabase.auth.updateUser({ email: normalizedEmail });
        if (updateUserError) throw new Error(updateUserError.message);
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: normalizedEmail,
            full_name: form.full_name.trim() || null,
            phone: form.phone.trim() || null,
            default_hourly_rate: form.default_hourly_rate.trim() ? parseFloat(form.default_hourly_rate) : null,
            advance_day: parsedAdvanceDay,
            salary_day: parsedSalaryDay,
            any_availability_bonus_amount: parsedAnyAvailabilityBonusAmount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) throw new Error(error.message);

      await saveCachedProfile(user.id, {
        email: normalizedEmail,
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        default_hourly_rate: form.default_hourly_rate.trim() ? parseFloat(form.default_hourly_rate) : null,
        advance_day: parsedAdvanceDay,
        salary_day: parsedSalaryDay,
        any_availability_bonus_amount: parsedAnyAvailabilityBonusAmount,
        updated_at: new Date().toISOString(),
      });

      await Promise.all([
        saveBonusSettings(bonusSettings),
        saveTaxSettings(taxSettings),
      ]);

      Alert.alert('Успешно', 'Настройки сохранены', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Настройки профиля</Text>

      <Text style={styles.label}>Имя</Text>
      <TextInput
        style={styles.input}
        value={form.full_name}
        onChangeText={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
        placeholder="Введите имя"
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
      />

      <Text style={styles.label}>Ставка по умолчанию (₽/ч)</Text>
      <TextInput
        style={styles.input}
        value={form.default_hourly_rate}
        onChangeText={(value) => setForm((prev) => ({ ...prev, default_hourly_rate: value }))}
        placeholder="500"
        keyboardType="numeric"
      />

      <View style={styles.bonusCard}>
        <View style={[styles.row, styles.firstRow]}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Учитывать НДФЛ 13%</Text>
            <Text style={styles.rowDescription}>Если включено, в доходах показывается сумма после удержания налога</Text>
          </View>
          <Switch
            value={taxSettings.includeNdfl}
            onValueChange={(value) => setTaxSettings((prev) => ({ ...prev, includeNdfl: value }))}
            thumbColor={taxSettings.includeNdfl ? Colors.primary : '#f4f3f4'}
            trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
          />
        </View>

        <Text style={styles.bonusTitle}>Работник «Вкусно и точка»</Text>

        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Работник «Вкусно и точка»</Text>
            <Text style={styles.rowDescription}>Включает специальный расчет бонусов и выплат в статистике</Text>
          </View>
          <Switch
            value={bonusSettings.isVkusnoWorker}
            onValueChange={(value) =>
              setBonusSettings((prev) => ({
                ...prev,
                isVkusnoWorker: value,
              }))
            }
            thumbColor={bonusSettings.isVkusnoWorker ? Colors.primary : '#f4f3f4'}
            trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
          />
        </View>

        {bonusSettings.isVkusnoWorker && (
          <>
            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Премия «Любые временные возможности»</Text>
                <Text style={styles.rowDescription}>Если включено, к зарплате добавляется сумма из поля ниже без подсчета часов</Text>
              </View>
              <Switch
                value={bonusSettings.anyAvailabilityBonusEnabled}
                onValueChange={(value) =>
                  setBonusSettings((prev) => ({
                    ...prev,
                    anyAvailabilityBonusEnabled: value,
                  }))
                }
                thumbColor={bonusSettings.anyAvailabilityBonusEnabled ? Colors.primary : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
              />
            </View>

            {bonusSettings.anyAvailabilityBonusEnabled && (
              <>
                <Text style={styles.label}>Сумма премии (₽)</Text>
                <TextInput
                  style={styles.input}
                  value={form.any_availability_bonus_amount}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, any_availability_bonus_amount: value }))}
                  placeholder="12000"
                  keyboardType="numeric"
                />
              </>
            )}

            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Бонус к ставке при 120+ часах</Text>
                <Text style={styles.rowDescription}>Если включено, при 120+ часах добавляется +100 ₽/ч как раньше</Text>
              </View>
              <Switch
                value={bonusSettings.hourlyRateBonusEnabled}
                onValueChange={(value) =>
                  setBonusSettings((prev) => ({
                    ...prev,
                    hourlyRateBonusEnabled: value,
                  }))
                }
                thumbColor={bonusSettings.hourlyRateBonusEnabled ? Colors.primary : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
              />
            </View>

            <Text style={styles.label}>Дата аванса</Text>
            <TouchableOpacity style={styles.dayPickerButton} onPress={() => setShowAdvancePicker(true)}>
              <Text style={styles.dayPickerValue}>{clampDay(form.advance_day, DEFAULT_ADVANCE_DAY)} число месяца</Text>
              <Text style={styles.dayPickerHint}>Сохраняется в профиле и используется в статистике</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Дата зарплаты</Text>
            <TouchableOpacity style={styles.dayPickerButton} onPress={() => setShowSalaryPicker(true)}>
              <Text style={styles.dayPickerValue}>{clampDay(form.salary_day, DEFAULT_SALARY_DAY)} число месяца</Text>
              <Text style={styles.dayPickerHint}>Для зарплаты используется следующий месяц</Text>
            </TouchableOpacity>

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
          </>
        )}
      </View>

      <TouchableOpacity style={[styles.button, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.buttonText}>Сохранить</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray, marginBottom: 16 },
  label: { fontSize: 14, color: Colors.gray, marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.darkGray, backgroundColor: Colors.white },
  bonusCard: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  bonusTitle: { fontSize: 17, fontWeight: '700', color: Colors.darkGray, paddingTop: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 12 },
  firstRow: { borderTopWidth: 0 },
  rowTextWrap: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.darkGray },
  rowDescription: { marginTop: 4, fontSize: 12, color: Colors.gray },
  bonusMutualHint: { marginTop: 10, marginBottom: 2, fontSize: 12, color: Colors.gray },
  dayPickerButton: { marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 12 },
  dayPickerValue: { fontSize: 16, fontWeight: '600', color: Colors.darkGray },
  dayPickerHint: { marginTop: 4, fontSize: 12, color: Colors.gray },
  button: { marginTop: 20, backgroundColor: Colors.primary, padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
