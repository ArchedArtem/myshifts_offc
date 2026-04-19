import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_KEY = 'myshifts_profile_cache_v1';

export type CachedProfile = {
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  default_hourly_rate?: number | null;
  advance_day?: number | null;
  salary_day?: number | null;
  any_availability_bonus_amount?: number | null;
  updated_at?: string | null;
};

const loadAllCachedProfiles = async (): Promise<Record<string, CachedProfile>> => {
  const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, CachedProfile>) : {};
  } catch {
    return {};
  }
};

const saveAllCachedProfiles = async (profiles: Record<string, CachedProfile>) => {
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profiles));
};

export const loadCachedProfile = async (userId?: string | null): Promise<CachedProfile> => {
  if (!userId) return {};
  const profiles = await loadAllCachedProfiles();
  return profiles[userId] || {};
};

export const saveCachedProfile = async (userId: string, patch: CachedProfile): Promise<void> => {
  if (!userId) return;

  const profiles = await loadAllCachedProfiles();
  profiles[userId] = {
    ...(profiles[userId] || {}),
    ...patch,
  };
  await saveAllCachedProfiles(profiles);
};

export const clearCachedProfile = async (userId?: string | null) => {
  if (!userId) {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
    return;
  }

  const profiles = await loadAllCachedProfiles();
  delete profiles[userId];
  await saveAllCachedProfiles(profiles);
};
