import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, StyleSheet, View, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { BonusSettings, defaultBonusSettings, loadBonusSettings, saveBonusSettings } from '@/services/bonusSettings';
import { useTheme } from '@/hooks/useTheme';

interface ProfileForm {
  email: string;
  full_name: string;
  phone: string;
  default_hourly_rate: string;
}

export default function SettingsScreen() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ email: '', full_name: '', phone: '', default_hourly_rate: '' });
  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(defaultBonusSettings);
  const { user } = useAuth();
  const router = useRouter();
  useTheme();
  const styles = createStyles();

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name, phone, default_hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) {
        setForm({ email: user.email ?? '', full_name: '', phone: '', default_hourly_rate: '' });
      } else {
        setForm({
          email: data?.email ?? user.email ?? '',
          full_name: data?.full_name ?? '',
          phone: data?.phone ?? '',
          default_hourly_rate: data?.default_hourly_rate ? String(data.default_hourly_rate) : '',
        });
      }

      const loadedBonusSettings = await loadBonusSettings();
      setBonusSettings(loadedBonusSettings);
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const normalizedEmail = form.email.trim().toLowerCase();

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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) throw new Error(error.message);

      await saveBonusSettings(bonusSettings);

      Alert.alert('Успешно', 'Настройки сохранены', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Настройки профиля</Text>

      <Text style={styles.label}>Имя</Text>
      <TextInput style={styles.input} value={form.full_name} onChangeText={(v) => setForm((p) => ({ ...p, full_name: v }))} placeholder="Введите имя" />

      <Text style={styles.label}>Телефон</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="+7..." keyboardType="phone-pad" />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="example@mail.ru" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

      <Text style={styles.label}>Ставка по умолчанию (₽/ч)</Text>
      <TextInput style={styles.input} value={form.default_hourly_rate} onChangeText={(v) => setForm((p) => ({ ...p, default_hourly_rate: v }))} placeholder="500" keyboardType="numeric" />

      <View style={styles.bonusCard}>
        <Text style={styles.bonusTitle}>Система премий (для работников ВиТ)</Text>

        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Включить систему премий</Text>
            <Text style={styles.rowDescription}>Начислять премии автоматически в статистике</Text>
          </View>
          <Switch
            value={bonusSettings.bonusSystemEnabled}
            onValueChange={(value) =>
              setBonusSettings((prev) => ({
                ...prev,
                bonusSystemEnabled: value,
                ...(value ? {} : { fullTimeAvailabilityBonusEnabled: false, anyAvailabilityBonusEnabled: false }),
              }))
            }
            thumbColor={bonusSettings.bonusSystemEnabled ? Colors.primary : '#f4f3f4'}
            trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
          />
        </View>

        {bonusSettings.bonusSystemEnabled && (
          <>
            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Полные временные возможности</Text>
                <Text style={styles.rowDescription}>35ч/нед + смена в сб/вс = +10 000 ₽</Text>
              </View>
              <Switch
                value={bonusSettings.fullTimeAvailabilityBonusEnabled}
                onValueChange={(value) => setBonusSettings((prev) => ({
                  ...prev,
                  fullTimeAvailabilityBonusEnabled: value,
                  anyAvailabilityBonusEnabled: value ? false : prev.anyAvailabilityBonusEnabled,
                }))}
                thumbColor={bonusSettings.fullTimeAvailabilityBonusEnabled ? Colors.primary : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
              />
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Любые временные возможности</Text>
                <Text style={styles.rowDescription}>40ч/нед = +17 000 ₽</Text>
              </View>
              <Switch
                value={bonusSettings.anyAvailabilityBonusEnabled}
                onValueChange={(value) => setBonusSettings((prev) => ({
                  ...prev,
                  anyAvailabilityBonusEnabled: value,
                  fullTimeAvailabilityBonusEnabled: value ? false : prev.fullTimeAvailabilityBonusEnabled,
                }))}
                thumbColor={bonusSettings.anyAvailabilityBonusEnabled ? Colors.primary : '#f4f3f4'}
                trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
              />
            </View>

            <Text style={styles.bonusMutualHint}>Можно выбрать только один тип недельной премии.</Text>
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
  lastRow: { borderBottomWidth: 0 },
  rowTextWrap: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.darkGray },
  rowDescription: { marginTop: 4, fontSize: 12, color: Colors.gray },
  bonusMutualHint: { marginTop: 10, marginBottom: 2, fontSize: 12, color: Colors.gray },
  button: { marginTop: 20, backgroundColor: Colors.primary, padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: Colors.onPrimary, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
