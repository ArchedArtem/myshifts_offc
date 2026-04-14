import AsyncStorage from '@react-native-async-storage/async-storage';

export const BONUS_SETTINGS_KEY = 'myshifts_bonus_settings_v1';

export interface BonusSettings {
  isVkusnoWorker: boolean;
}

export const defaultBonusSettings: BonusSettings = {
  isVkusnoWorker: false,
};

export const loadBonusSettings = async (): Promise<BonusSettings> => {
  try {
    const raw = await AsyncStorage.getItem(BONUS_SETTINGS_KEY);
    if (!raw) return defaultBonusSettings;
    const parsed = JSON.parse(raw) as Partial<BonusSettings> & { bonusSystemEnabled?: boolean };
    return {
      isVkusnoWorker: Boolean(parsed.isVkusnoWorker ?? parsed.bonusSystemEnabled),
    };
  } catch {
    return defaultBonusSettings;
  }
};

export const saveBonusSettings = async (settings: BonusSettings) => {
  await AsyncStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(settings));
};
