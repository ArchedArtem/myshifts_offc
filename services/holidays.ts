import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

const HOLIDAYS_CACHE_KEY = 'myshifts_holidays_cache_v1';

export type Holiday = {
  date: string;
  name: string;
};

type HolidayRow = {
  holiday_date: string;
  name: string;
};

const saveHolidayCache = async (holidays: Holiday[]) => {
  await AsyncStorage.setItem(HOLIDAYS_CACHE_KEY, JSON.stringify(holidays));
};

const loadHolidayCache = async (): Promise<Holiday[]> => {
  const raw = await AsyncStorage.getItem(HOLIDAYS_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Holiday[]) : [];
  } catch {
    return [];
  }
};

export const loadHolidays = async (): Promise<Holiday[]> => {
  try {
    const { data, error } = await supabase
      .from('holidays')
      .select('holiday_date, name')
      .eq('is_active', true)
      .order('holiday_date', { ascending: true });

    if (error) throw error;

    const holidays = ((data || []) as HolidayRow[]).map((row) => ({
      date: row.holiday_date,
      name: row.name,
    }));

    await saveHolidayCache(holidays);
    return holidays;
  } catch {
    return loadHolidayCache();
  }
};

export const loadHolidayDateSet = async (): Promise<Set<string>> => {
  const holidays = await loadHolidays();
  return new Set(holidays.map((row) => row.date));
};
