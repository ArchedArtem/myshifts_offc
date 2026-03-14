import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { addDays, format } from 'date-fns';
import { supabase } from '@/services/supabase/client';
import { registerDevicePushToken } from '@/services/pushNotifications';

const IDS_KEY = 'myshifts_notification_ids_v1';
export const NOTIFICATION_SETTINGS_KEY = 'myshifts_notification_settings_v1';
const CHANNEL_ID = 'myshifts-reminders';
const SMART_REMINDER_HOURS = 2;

let ExpoNotifications: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoNotifications = require('expo-notifications');
} catch {
  ExpoNotifications = null;
}

interface NotificationSettings {
  shiftReminders: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  sound: boolean;
  vibration: boolean;
}

type ShiftRow = {
  date: string;
  start_time: string;
};

const defaultSettings: NotificationSettings = {
  shiftReminders: true,
  dailySummary: false,
  weeklySummary: true,
  sound: true,
  vibration: true,
};

const loadExpoNotifications = async () => ExpoNotifications;

const getStoredIds = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setStoredIds = async (ids: string[]) => {
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
};

const getSavedSettings = async (): Promise<NotificationSettings> => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
};

const cancelScheduled = async (Notifications: any) => {
  const ids = await getStoredIds();
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore per-id failures
    }
  }
  await setStoredIds([]);
};

const ensureAndroidChannel = async (Notifications: any, settings: NotificationSettings) => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'MyShifts Напоминания',
    importance: Notifications.AndroidImportance?.HIGH ?? 4,
    sound: settings.sound ? 'default' : null,
    enableVibrate: settings.vibration,
    vibrationPattern: settings.vibration ? [0, 250, 150, 250] : [0],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC,
  });
};

const getNotificationContent = (title: string, body: string, settings: NotificationSettings) => ({
  title,
  body,
  sound: settings.sound,
  ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
});

const getTriggerTypes = (Notifications: any) => Notifications.SchedulableTriggerInputTypes || {};

const getDailyTrigger = (Notifications: any, hour: number, minute: number) => ({
  type: getTriggerTypes(Notifications).DAILY ?? 'daily',
  hour,
  minute,
  ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
});

const getWeeklyTrigger = (Notifications: any, weekday: number, hour: number, minute: number) => ({
  type: getTriggerTypes(Notifications).WEEKLY ?? 'weekly',
  weekday,
  hour,
  minute,
  ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
});

const getTimeIntervalTrigger = (Notifications: any, seconds: number) => ({
  type: getTriggerTypes(Notifications).TIME_INTERVAL ?? 'timeInterval',
  seconds,
  ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
});

const parseShiftDateTime = (date: string, time: string) => {
  const normalized = time?.split(':').slice(0, 2).join(':') || '00:00';
  return new Date(`${date}T${normalized}:00`);
};

const scheduleSmartNotifications = async (
  Notifications: any,
  settings: NotificationSettings,
  userId: string,
): Promise<string[]> => {
  const ids: string[] = [];
  const now = new Date();

  const tomorrow = addDays(now, 1);
  const tomorrowDate = format(tomorrow, 'yyyy-MM-dd');
  const todayDate = format(now, 'yyyy-MM-dd');

  const { data: tomorrowShifts } = await supabase
    .from('shifts')
    .select('date, start_time')
    .eq('user_id', userId)
    .eq('date', tomorrowDate)
    .order('start_time', { ascending: true });

  const tomorrowRows = (tomorrowShifts || []) as ShiftRow[];
  for (const shift of tomorrowRows) {
    const start = parseShiftDateTime(shift.date, shift.start_time);
    const reminderAt = new Date(start.getTime() - SMART_REMINDER_HOURS * 60 * 60 * 1000);
    const seconds = Math.floor((reminderAt.getTime() - now.getTime()) / 1000);

    if (seconds > 30) {
      const id = await Notifications.scheduleNotificationAsync({
        content: getNotificationContent(
          'Смена уже скоро',
          `Сегодня смена в ${shift.start_time?.split(':').slice(0, 2).join(':')}. Подготовься заранее 👌`,
          settings,
        ),
        trigger: getTimeIntervalTrigger(Notifications, seconds),
      });
      ids.push(id);
    }
  }

  const { data: todayShifts } = await supabase
    .from('shifts')
    .select('date')
    .eq('user_id', userId)
    .eq('date', todayDate);

  const hasTodayShift = (todayShifts || []).length > 0;
  if (!hasTodayShift) {
    const softReminder = new Date(now);
    softReminder.setHours(19, 0, 0, 0);
    const seconds = Math.floor((softReminder.getTime() - now.getTime()) / 1000);

    if (seconds > 30) {
      const id = await Notifications.scheduleNotificationAsync({
        content: getNotificationContent(
          'Добавь смену за сегодня',
          'Похоже, сегодня еще нет сохраненной смены. Проверь и добавь, если работал 💼',
          settings,
        ),
        trigger: getTimeIntervalTrigger(Notifications, seconds),
      });
      ids.push(id);
    }
  }

  return ids;
};

export const initializeNotifications = async () => {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return false;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const settings = await getSavedSettings();
  await ensureAndroidChannel(Notifications, settings);

  return true;
};

export const syncPushTokenForUser = async (userId: string): Promise<{ ok: boolean; reason?: string }> => {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    return { ok: false, reason: 'Не удалось инициализировать модуль уведомлений.' };
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return { ok: false, reason: 'Нет разрешения на push-уведомления.' };
  }

  return registerDevicePushToken(Notifications, userId);
};

export const applyNotificationSettings = async (
  settings: NotificationSettings,
  userId?: string,
): Promise<{ ok: boolean; reason?: string }> => {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    return { ok: false, reason: 'Не удалось инициализировать модуль уведомлений.' };
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return { ok: false, reason: 'Нет разрешения на уведомления.' };
  }

  await ensureAndroidChannel(Notifications, settings);
  await cancelScheduled(Notifications);

  const scheduledIds: string[] = [];

  if (settings.shiftReminders) {
    const id = await Notifications.scheduleNotificationAsync({
      content: getNotificationContent('Мои смены', 'Не забудьте проверить сегодняшнюю смену.', settings),
      trigger: getDailyTrigger(Notifications, 8, 0),
    });
    scheduledIds.push(id);

    if (userId) {
      const smartIds = await scheduleSmartNotifications(Notifications, settings, userId);
      scheduledIds.push(...smartIds);
    }
  }

  if (settings.dailySummary) {
    const id = await Notifications.scheduleNotificationAsync({
      content: getNotificationContent('Итог дня', 'Проверьте, все ли смены за сегодня сохранены.', settings),
      trigger: getDailyTrigger(Notifications, 21, 0),
    });
    scheduledIds.push(id);
  }

  if (settings.weeklySummary) {
    const id = await Notifications.scheduleNotificationAsync({
      content: getNotificationContent('Итог недели', 'Откройте статистику и посмотрите недельный результат.', settings),
      trigger: getWeeklyTrigger(Notifications, 1, 12, 0),
    });
    scheduledIds.push(id);
  }

  await setStoredIds(scheduledIds);
  return { ok: true };
};

export const sendTestNotification = async (): Promise<{ ok: boolean; reason?: string }> => {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    return { ok: false, reason: 'Не удалось инициализировать модуль уведомлений.' };
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') {
      return { ok: false, reason: 'Нет разрешения на уведомления.' };
    }
  }

  const settings = await getSavedSettings();
  await ensureAndroidChannel(Notifications, settings);

  await Notifications.scheduleNotificationAsync({
    content: getNotificationContent('Тест уведомления', 'Уведомления Мои смены работают ✅', settings),
    trigger: getTimeIntervalTrigger(Notifications, 1),
  });

  return { ok: true };
};
