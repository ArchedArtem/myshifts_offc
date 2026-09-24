import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

const HOLIDAYS_CACHE_KEY = 'myshifts_holidays_cache_v2';

export type Holiday = {
  date: string; // Формат 'MM-DD' (ежегодный) или 'YYYY-MM-DD' (конкретный год)
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

/**
 * Проверяет, является ли дата смены (в формате YYYY-MM-DD) праздником.
 * Учитывает и точную дату (с годом), и ежегодные праздники (MM-DD).
 */
/**
 * Проверяет, является ли дата смены (YYYY-MM-DD) праздником.
 * Учитывает и точную дату (с годом YYYY-MM-DD), и ежегодные праздники (MM-DD).
 */
export const isHolidayDate = (shiftDate: string, holidaySet: Set<string>): boolean => {
  if (!shiftDate || !holidaySet || holidaySet.size === 0) return false;

  // shiftDate обычно "2026-05-09"
  // Извлекаем "05-09" и "2026-05-09"
  const fullDate = shiftDate.trim();
  const mmdd = fullDate.length >= 10 ? fullDate.slice(5, 10) : fullDate;

  // Проверяем все возможные варианты совпадения с тем, что пришло из базы
  if (holidaySet.has(fullDate)) return true;
  if (holidaySet.has(mmdd)) return true;

  // На всякий случай проверяем без ведущих нулей или с ними
  for (const holiday of holidaySet) {
    const cleanHoliday = holiday.trim();
    if (cleanHoliday === fullDate || cleanHoliday === mmdd) {
      return true;
    }
  }

  return false;
};