import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/Colors';
import { applyNotificationSettings, NOTIFICATION_SETTINGS_KEY, sendTestNotification } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const STORAGE_KEY = NOTIFICATION_SETTINGS_KEY;

interface NotificationSettings {
  shiftReminders: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  sound: boolean;
  vibration: boolean;
}

const defaultSettings: NotificationSettings = {
  shiftReminders: true,
  dailySummary: false,
  weeklySummary: true,
  sound: true,
  vibration: true,
};

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        }
      } catch {
        // ignore and keep defaults
      }
    };

    load();
  }, []);

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const result = await applyNotificationSettings(settings, user?.id);
      if (!result.ok) {
        Alert.alert('Сохранено частично', result.reason || 'Не удалось применить системные уведомления.');
        return;
      }

      Alert.alert('Готово', 'Настройки уведомлений сохранены и применены.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить настройки уведомлений');
    } finally {
      setSaving(false);
    }
  };

  const triggerTestNotification = async () => {
    const result = await sendTestNotification();
    if (!result.ok) {
      Alert.alert('Ошибка', result.reason || 'Не удалось отправить тестовое уведомление');
      return;
    }

    Alert.alert('Отправлено', 'Тестовое уведомление запланировано.');
  };

  const Row = ({
    title,
    description,
    value,
    onValueChange,
  }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.row}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? Colors.primary : '#f4f3f4'}
        trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Уведомления</Text>
      <Text style={styles.subtitle}>Настройте какие уведомления вы хотите получать. Умные напоминания учитывают ваши смены на сегодня/завтра.</Text>

      <View style={styles.card}>
        <Row
          title="Напоминания о смене"
          description="Ежедневное напоминание утром проверить смену"
          value={settings.shiftReminders}
          onValueChange={(v) => updateSetting('shiftReminders', v)}
        />
        <Row
          title="Ежедневный итог"
          description="Напоминание вечером проверить сохраненные смены"
          value={settings.dailySummary}
          onValueChange={(v) => updateSetting('dailySummary', v)}
        />
        <Row
          title="Недельный итог"
          description="Напоминание по понедельникам открыть статистику"
          value={settings.weeklySummary}
          onValueChange={(v) => updateSetting('weeklySummary', v)}
        />
        <Row
          title="Звук"
          description="Проигрывать звук у локальных уведомлений"
          value={settings.sound}
          onValueChange={(v) => updateSetting('sound', v)}
        />
        <Row
          title="Вибрация"
          description="Виброотклик на уровне устройства"
          value={settings.vibration}
          onValueChange={(v) => updateSetting('vibration', v)}
        />
      </View>

      <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={saveSettings} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Сохранение...' : 'Сохранить настройки'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.testButton} onPress={triggerTestNotification}>
        <Text style={styles.testButtonText}>Отправить тестовое уведомление</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray, marginBottom: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowTextWrap: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.darkGray },
  rowDescription: { marginTop: 4, fontSize: 13, color: Colors.gray },
  saveButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    padding: 14,
  },
  saveButtonText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
  testButton: {
    marginTop: 10,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    padding: 14,
  },
  testButtonText: { color: Colors.darkGray, fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.7 },
});
