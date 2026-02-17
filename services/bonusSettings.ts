import AsyncStorage from '@react-native-async-storage/async-storage';

export const BONUS_SETTINGS_KEY = 'myshifts_bonus_settings_v1';

export interface BonusSettings {
  bonusSystemEnabled: boolean;
  fullTimeAvailabilityBonusEnabled: boolean;
  anyAvailabilityBonusEnabled: boolean;
}

export const defaultBonusSettings: BonusSettings = {
  bonusSystemEnabled: false,
  fullTimeAvailabilityBonusEnabled: false,
  anyAvailabilityBonusEnabled: false,
};

export const loadBonusSettings = async (): Promise<BonusSettings> => {
  try {
    const raw = await AsyncStorage.getItem(BONUS_SETTINGS_KEY);
    if (!raw) return defaultBonusSettings;
    const merged = { ...defaultBonusSettings, ...JSON.parse(raw) };

    if (merged.fullTimeAvailabilityBonusEnabled && merged.anyAvailabilityBonusEnabled) {
      merged.fullTimeAvailabilityBonusEnabled = false;
    }

    return merged;
  } catch {
    return defaultBonusSettings;
  }
};

export const saveBonusSettings = async (settings: BonusSettings) => {
  await AsyncStorage.setItem(BONUS_SETTINGS_KEY, JSON.stringify(settings));
};
