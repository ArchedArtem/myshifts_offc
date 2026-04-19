import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

export const BONUS_SETTINGS_KEY = 'myshifts_bonus_settings_v1';

export interface BonusSettings {
  isVkusnoWorker: boolean;
  anyAvailabilityBonusEnabled: boolean;
  hourlyRateBonusEnabled: boolean;
}

export const defaultBonusSettings: BonusSettings = {
  isVkusnoWorker: false,
  anyAvailabilityBonusEnabled: false,
  hourlyRateBonusEnabled: true,
};

export const loadBonusSettings = async (): Promise<BonusSettings> => {
  try {
    const [{ data: userData }, raw] = await Promise.all([
      supabase.auth.getUser(),
      AsyncStorage.getItem(BONUS_SETTINGS_KEY),
    ]);

    const parsed = raw ? (JSON.parse(raw) as Partial<BonusSettings> & { bonusSystemEnabled?: boolean }) : null;
    const legacyVkusnoEnabled = Boolean(parsed?.isVkusnoWorker ?? parsed?.bonusSystemEnabled);
    const localSettings: BonusSettings = {
      isVkusnoWorker: legacyVkusnoEnabled,
      anyAvailabilityBonusEnabled: Boolean(parsed?.anyAvailabilityBonusEnabled),
      hourlyRateBonusEnabled: parsed?.hourlyRateBonusEnabled ?? legacyVkusnoEnabled,
    };

    const userId = userData.user?.id;
    if (!userId) {
      return parsed ? localSettings : defaultBonusSettings;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('is_vkusno_worker, any_availability_bonus_enabled, hourly_rate_bonus_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return parsed ? localSettings : defaultBonusSettings;
    }

    if (!data) {
      return parsed ? localSettings : defaultBonusSettings;
    }

    const settingsFromDb: BonusSettings = {
      isVkusnoWorker: data.is_vkusno_worker ?? localSettings.isVkusnoWorker ?? defaultBonusSettings.isVkusnoWorker,
      anyAvailabilityBonusEnabled:
        data.any_availability_bonus_enabled ?? localSettings.anyAvailabilityBonusEnabled ?? defaultBonusSettings.anyAvailabilityBonusEnabled,
      hourlyRateBonusEnabled:
        data.hourly_rate_bonus_enabled ?? localSettings.hourlyRateBonusEnabled ?? defaultBonusSettings.hourlyRateBonusEnabled,
    };

    await AsyncStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(settingsFromDb));
    return settingsFromDb;
  } catch {
    return defaultBonusSettings;
  }
};

export const saveBonusSettings = async (settings: BonusSettings) => {
  await AsyncStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(settings));

  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const userId = user?.id;
    if (!userId) return;

    const payload = {
      is_vkusno_worker: settings.isVkusnoWorker,
      any_availability_bonus_enabled: settings.anyAvailabilityBonusEnabled,
      hourly_rate_bonus_enabled: settings.hourlyRateBonusEnabled,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('id');

    if (updateError) {
      throw updateError;
    }

    if (updatedRows && updatedRows.length > 0) {
      return;
    }

    const email = user.email?.trim().toLowerCase();
    if (!email) return;

    await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        ...payload,
      });
  } catch {
    // Ignore network/db sync errors here and keep local settings as fallback.
  }
};
