import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const raw = await AsyncStorage.getItem(BONUS_SETTINGS_KEY);
    if (!raw) return defaultBonusSettings;
    const parsed = JSON.parse(raw) as Partial<BonusSettings> & { bonusSystemEnabled?: boolean };
    const legacyVkusnoEnabled = Boolean(parsed.isVkusnoWorker ?? parsed.bonusSystemEnabled);
    return {
      isVkusnoWorker: legacyVkusnoEnabled,
      anyAvailabilityBonusEnabled: Boolean(parsed.anyAvailabilityBonusEnabled),
      hourlyRateBonusEnabled: parsed.hourlyRateBonusEnabled ?? legacyVkusnoEnabled,
    };
  } catch {
    return defaultBonusSettings;
  }
};

export const saveBonusSettings = async (settings: BonusSettings) => {
  await AsyncStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(settings));
};
