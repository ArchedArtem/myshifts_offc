import { supabase } from '@/services/supabase/client';

export type ShiftTemplate = {
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

export const loadCustomShiftTemplates = async (userId?: string): Promise<ShiftTemplate[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('shift_templates')
    .select('id, name, start_time, end_time, break_minutes')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as ShiftTemplateRow[])
    .map(mapRow)
    .filter((item) => item.name && item.startTime && item.endTime);
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

  return mapRow(data as ShiftTemplateRow);
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
};

export const getAllShiftTemplates = async (userId?: string): Promise<ShiftTemplate[]> => {
  return loadCustomShiftTemplates(userId);
};
