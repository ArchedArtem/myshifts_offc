import AsyncStorage from '@react-native-async-storage/async-storage';

export const TAX_SETTINGS_KEY = 'myshifts_tax_settings_v1';

export interface TaxSettings {
  includeNdfl: boolean;
}

export const defaultTaxSettings: TaxSettings = {
  includeNdfl: true,
};

export const loadTaxSettings = async (): Promise<TaxSettings> => {
  try {
    const raw = await AsyncStorage.getItem(TAX_SETTINGS_KEY);
    if (!raw) return defaultTaxSettings;
    return { ...defaultTaxSettings, ...JSON.parse(raw) };
  } catch {
    return defaultTaxSettings;
  }
};

export const saveTaxSettings = async (settings: TaxSettings) => {
  await AsyncStorage.setItem(TAX_SETTINGS_KEY, JSON.stringify(settings));
};
