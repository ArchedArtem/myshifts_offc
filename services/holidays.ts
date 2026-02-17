import { supabase } from '@/services/supabase/client';

export type Holiday = {
  date: string;
  name: string;
};

type HolidayRow = {
  holiday_date: string;
  name: string;
};

export const loadHolidayDateSet = async (): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('holidays')
    .select('holiday_date, name')
    .eq('is_active', true)
    .order('holiday_date', { ascending: true });

  if (error) {
    throw error;
  }

  return new Set(((data || []) as HolidayRow[]).map((row) => row.holiday_date));
};

export const loadHolidays = async (): Promise<Holiday[]> => {
  const { data, error } = await supabase
    .from('holidays')
    .select('holiday_date, name')
    .eq('is_active', true)
    .order('holiday_date', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as HolidayRow[]).map((row) => ({
    date: row.holiday_date,
    name: row.name,
  }));
};
