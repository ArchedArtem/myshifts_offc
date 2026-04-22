import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/Colors';
import { applyNotificationSettings, NOTIFICATION_SETTINGS_KEY, sendTestNotification } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import * as Haptics from '@/utils/haptics';

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const result = await applyNotificationSettings(settings, user?.id);
      if (!result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Сохранено частично', result.reason || 'Не удалось применить системные уведомления.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', 'Настройки уведомлений сохранены и применены.');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', 'Не удалось сохранить настройки уведомлений');
    } finally {
      setSaving(false);
    }
  };

  const triggerTestNotification = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await sendTestNotification();
    if (!result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', result.reason || 'Не удалось отправить тестовое уведомление');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Отправлено', 'Тестовое уведомление запланировано.');
  };

  const Row = ({
                 title,
                 description,
                 value,
                 onValueChange,
                 isLast = false,
               }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
  }) => (
      <View style={[styles.row, isLast && styles.lastRow]}>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDescription}>{description}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onValueChange}
            thumbColor={value ? Colors.white : Colors.white}
            trackColor={{ false: Colors.border, true: Colors.primary }}
        />
      </View>
  );

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Уведомления</Text>
          <Text style={styles.subtitle}>
            Настройте какие уведомления вы хотите получать. Умные напоминания учитывают ваши смены на сегодня и завтра.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Расписание</Text>
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
              isLast
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Сигнал</Text>
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
              isLast
          />
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabled]}
              onPress={saveSettings}
              disabled={saving}
              activeOpacity={0.8}
          >
            {saving ? (
                <ActivityIndicator color={Colors.onPrimary} />
            ) : (
                <Text style={styles.primaryButtonText}>Сохранить изменения</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
              style={styles.secondaryButton}
              onPress={triggerTestNotification}
              activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Отправить тестовое уведомление</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
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
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
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
  actionsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 16
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15
  },
  disabled: {
    backgroundColor: Colors.gray,
    shadowOpacity: 0,
    elevation: 0,
  },
});