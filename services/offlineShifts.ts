import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

const OFFLINE_SHIFTS_KEY = 'myshifts_offline_shifts_v1';
const OFFLINE_QUEUE_KEY = 'myshifts_offline_queue_v1';

type ShiftBase = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  extra_payment: number;
  earnings: number;
  notes?: string | null;
  break?: number | null;
  created_at?: string;
  updated_at?: string;
  is_pending?: boolean;
};

type QueueOp = {
  id: string;
  user_id: string;
  type: 'create' | 'update' | 'delete';
  shift_id: string;
  payload?: Partial<ShiftBase>;
  created_at: string;
};

const isNetworkError = (error: unknown): boolean => {
  const message = String((error as any)?.message || '').toLowerCase();
  return (
    message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('failed to fetch')
    || message.includes('network error')
    || message.includes('offline')
  );
};

const makeLocalId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const loadAllCachedShifts = async (): Promise<Record<string, ShiftBase[]>> => {
  const raw = await AsyncStorage.getItem(OFFLINE_SHIFTS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, ShiftBase[]>;
  } catch {
    return {};
  }
};

const saveAllCachedShifts = async (value: Record<string, ShiftBase[]>) => {
  await AsyncStorage.setItem(OFFLINE_SHIFTS_KEY, JSON.stringify(value));
};

const loadQueue = async (): Promise<QueueOp[]> => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as QueueOp[] : [];
  } catch {
    return [];
  }
};

const saveQueue = async (ops: QueueOp[]) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(ops));
};

const getUserShifts = async (userId: string): Promise<ShiftBase[]> => {
  const all = await loadAllCachedShifts();
  return all[userId] || [];
};

const setUserShifts = async (userId: string, shifts: ShiftBase[]) => {
  const all = await loadAllCachedShifts();
  all[userId] = shifts;
  await saveAllCachedShifts(all);
};

const upsertInCache = (rows: ShiftBase[], next: ShiftBase): ShiftBase[] => {
  const without = rows.filter((item) => item.id !== next.id);
  return [next, ...without].sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`));
};

const patchInCache = (rows: ShiftBase[], id: string, patch: Partial<ShiftBase>): ShiftBase[] =>
  rows.map((item) => (item.id === id ? { ...item, ...patch } : item));

export const getPendingOpsCount = async (userId: string): Promise<number> => {
  const queue = await loadQueue();
  return queue.filter((item) => item.user_id === userId).length;
};

export const syncPendingShiftOps = async (userId: string): Promise<{ synced: number; pending: number }> => {
  const queue = await loadQueue();
  const own = queue.filter((item) => item.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (own.length === 0) return { synced: 0, pending: 0 };

  const rest = queue.filter((item) => item.user_id !== userId);
  const idMap: Record<string, string> = {};
  let synced = 0;

  for (let idx = 0; idx < own.length; idx += 1) {
    const op = own[idx];
    const realId = idMap[op.shift_id] || op.shift_id;

    try {
      if (op.type === 'create') {
        const payload = { ...op.payload } as Record<string, unknown>;
        delete payload.id;
        delete payload.is_pending;

        const { data, error } = await supabase
          .from('shifts')
          .insert([payload])
          .select('*')
          .single();

        if (error) throw error;
        idMap[op.shift_id] = data.id;

        const cache = await getUserShifts(userId);
        const replaced = cache
          .filter((row) => row.id !== op.shift_id)
          .concat([{ ...(data as ShiftBase), is_pending: false }]);
        await setUserShifts(userId, replaced);
      }

      if (op.type === 'update') {
        const payload = { ...op.payload } as Record<string, unknown>;
        delete payload.id;
        delete payload.is_pending;
        const { error } = await supabase
          .from('shifts')
          .update(payload)
          .eq('id', realId)
          .eq('user_id', userId);

        if (error) throw error;

        const cache = await getUserShifts(userId);
        await setUserShifts(userId, patchInCache(cache, realId, { ...(op.payload || {}), is_pending: false }));
      }

      if (op.type === 'delete') {
        const { error } = await supabase
          .from('shifts')
          .delete()
          .eq('id', realId)
          .eq('user_id', userId);

        if (error) throw error;

        const cache = await getUserShifts(userId);
        await setUserShifts(userId, cache.filter((row) => row.id !== realId));
      }

      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        const pending = [...own.slice(idx), ...rest];
        await saveQueue(pending);
        return { synced, pending: pending.length };
      }

      // Пропускаем "битую" операцию, чтобы очередь не блокировалась навсегда.
      // eslint-disable-next-line no-continue
      continue;
    }
  }

  await saveQueue(rest);
  return { synced, pending: rest.length };
};

export const getShiftsWithOffline = async (params: {
  userId: string;
  start: string;
  end: string;
}): Promise<{ shifts: ShiftBase[]; fromCache: boolean; pendingCount: number }> => {
  const cached = (await getUserShifts(params.userId)).filter((row) => row.date >= params.start && row.date <= params.end);

  try {
    await syncPendingShiftOps(params.userId);

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', params.userId)
      .gte('date', params.start)
      .lte('date', params.end)
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const merged = data as ShiftBase[];
    const fullCache = await getUserShifts(params.userId);
    const outsideRange = fullCache.filter((row) => row.date < params.start || row.date > params.end);
    await setUserShifts(params.userId, [...outsideRange, ...merged]);

    return {
      shifts: merged,
      fromCache: false,
      pendingCount: await getPendingOpsCount(params.userId),
    };
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return {
      shifts: cached,
      fromCache: true,
      pendingCount: await getPendingOpsCount(params.userId),
    };
  }
};

export const getShiftByIdOffline = async (userId: string, shiftId: string): Promise<ShiftBase | null> => {
  const rows = await getUserShifts(userId);
  return rows.find((row) => row.id === shiftId) || null;
};

export const saveShiftOfflineAware = async (params: {
  userId: string;
  isEdit: boolean;
  shiftId?: string;
  shiftData: Omit<ShiftBase, 'id' | 'is_pending'>;
}): Promise<{ queued: boolean; shiftId: string }> => {
  const cache = await getUserShifts(params.userId);

  if (params.isEdit && params.shiftId) {
    try {
      const { error } = await supabase
        .from('shifts')
        .update(params.shiftData)
        .eq('id', params.shiftId)
        .eq('user_id', params.userId);
      if (error) throw error;

      await setUserShifts(params.userId, patchInCache(cache, params.shiftId, { ...params.shiftData, is_pending: false }));
      return { queued: false, shiftId: params.shiftId };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      const op: QueueOp = {
        id: makeLocalId(),
        user_id: params.userId,
        type: 'update',
        shift_id: params.shiftId,
        payload: { ...params.shiftData, is_pending: true },
        created_at: new Date().toISOString(),
      };
      const queue = await loadQueue();
      await saveQueue([...queue, op]);
      await setUserShifts(params.userId, patchInCache(cache, params.shiftId, { ...params.shiftData, is_pending: true }));
      return { queued: true, shiftId: params.shiftId };
    }
  }

  const tempId = makeLocalId();
  const optimisticShift: ShiftBase = {
    id: tempId,
    ...params.shiftData,
    is_pending: true,
  };

  try {
    const { data, error } = await supabase
      .from('shifts')
      .insert([params.shiftData])
      .select('*')
      .single();

    if (error) throw error;

    await setUserShifts(params.userId, upsertInCache(cache, { ...(data as ShiftBase), is_pending: false }));
    return { queued: false, shiftId: data.id as string };
  } catch (error) {
    if (!isNetworkError(error)) throw error;

    const op: QueueOp = {
      id: makeLocalId(),
      user_id: params.userId,
      type: 'create',
      shift_id: tempId,
      payload: optimisticShift,
      created_at: new Date().toISOString(),
    };
    const queue = await loadQueue();
    await saveQueue([...queue, op]);
    await setUserShifts(params.userId, upsertInCache(cache, optimisticShift));
    return { queued: true, shiftId: tempId };
  }
};

export const deleteShiftOfflineAware = async (params: {
  userId: string;
  shiftId: string;
}): Promise<{ queued: boolean }> => {
  const cache = await getUserShifts(params.userId);

  try {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', params.shiftId)
      .eq('user_id', params.userId);

    if (error) throw error;
    await setUserShifts(params.userId, cache.filter((row) => row.id !== params.shiftId));
    return { queued: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;

    const queue = await loadQueue();
    const op: QueueOp = {
      id: makeLocalId(),
      user_id: params.userId,
      type: 'delete',
      shift_id: params.shiftId,
      created_at: new Date().toISOString(),
    };

    await saveQueue([...queue, op]);
    await setUserShifts(params.userId, cache.filter((row) => row.id !== params.shiftId));
    return { queued: true };
  }
};
