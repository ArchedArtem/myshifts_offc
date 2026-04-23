import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

const SHIFT_TEMPLATES_CACHE_KEY = 'myshifts_shift_templates_cache_v1';

export type ShiftTemplate = {
  user_id?: string;
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

type ShiftTemplateRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number | null;
};

const normalizeTime = (time: string) => String(time || '').split(':').slice(0, 2).join(':');

const mapRow = (row: ShiftTemplateRow): ShiftTemplate => ({
  id: row.id,
  name: String(row.name || '').trim(),
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  breakMinutes: Math.min(120, Math.max(0, Number(row.break_minutes) || 0)),
});

const loadAllCachedTemplates = async (): Promise<Record<string, ShiftTemplate[]>> => {
  const raw = await AsyncStorage.getItem(SHIFT_TEMPLATES_CACHE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ShiftTemplate[]>) : {};
  } catch {
    return {};
  }
};

const saveAllCachedTemplates = async (value: Record<string, ShiftTemplate[]>) => {
  await AsyncStorage.setItem(SHIFT_TEMPLATES_CACHE_KEY, JSON.stringify(value));
};

const loadCachedTemplates = async (userId?: string): Promise<ShiftTemplate[]> => {
  if (!userId) return [];
  const all = await loadAllCachedTemplates();
  return Array.isArray(all[userId]) ? all[userId] : [];
};

const saveCachedTemplates = async (userId: string, templates: ShiftTemplate[]) => {
  const all = await loadAllCachedTemplates();
  all[userId] = templates;
  await saveAllCachedTemplates(all);
};

export const loadCustomShiftTemplates = async (userId?: string): Promise<ShiftTemplate[]> => {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('shift_templates')
      .select('id, name, start_time, end_time, break_minutes')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const templates = ((data || []) as ShiftTemplateRow[])
      .map(mapRow)
      .filter((item) => item.name && item.startTime && item.endTime);

    await saveCachedTemplates(userId, templates);
    return templates;
  } catch {
    return loadCachedTemplates(userId);
  }
};

export const createCustomShiftTemplate = async (
  userId: string,
  template: { name: string; startTime: string; endTime: string; breakMinutes: number },
): Promise<ShiftTemplate> => {
  const payload = {
    user_id: userId,
    name: template.name.trim(),
    start_time: template.startTime,
    end_time: template.endTime,
    break_minutes: Math.min(120, Math.max(0, template.breakMinutes || 0)),
  };

  const { data, error } = await supabase
    .from('shift_templates')
    .insert([payload])
    .select('id, name, start_time, end_time, break_minutes')
    .single();

  if (error) {
    throw error;
  }

  const created = mapRow(data as ShiftTemplateRow);
  const cached = await loadCachedTemplates(userId);
  await saveCachedTemplates(userId, [...cached, created]);
  return created;
};

export const deleteCustomShiftTemplate = async (templateId: string, userId: string) => {
  const { error } = await supabase
    .from('shift_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const cached = await loadCachedTemplates(userId);
  await saveCachedTemplates(userId, cached.filter((item) => item.id !== templateId));
};

export const getAllShiftTemplates = async (userId?: string): Promise<ShiftTemplate[]> => {
  return loadCustomShiftTemplates(userId);
};
