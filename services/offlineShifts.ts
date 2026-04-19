import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';
import { getShiftSyncState, setShiftSyncState } from '@/services/shiftSyncState';

const OFFLINE_SHIFTS_KEY = 'myshifts_offline_shifts_v1';
const OFFLINE_QUEUE_KEY = 'myshifts_offline_queue_v1';

export type ShiftCacheSyncState = 'synced' | 'pending' | 'error';

export type ShiftBase = {
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
  sync_state?: ShiftCacheSyncState;
  sync_error?: string | null;
};

type QueueOp = {
  id: string;
  user_id: string;
  type: 'create' | 'update' | 'delete';
  shift_id: string;
  payload?: Partial<ShiftBase>;
  created_at: string;
  last_error?: string | null;
};

export type PendingShiftSyncResult = {
  ok: boolean;
  synced: number;
  pending: number;
  networkUnavailable: boolean;
  errorMessage: string | null;
};

const sanitizeShiftPayloadForServer = (payload: Record<string, unknown>) => {
  const clean = { ...payload };
  delete clean.earnings;
  delete clean.id;
  delete clean.is_pending;
  delete clean.sync_state;
  delete clean.sync_error;
  delete clean.created_at;
  delete clean.updated_at;
  return clean;
};

const isNetworkError = (error: unknown): boolean => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('offline') ||
    message.includes('connection') ||
    message.includes('timed out')
  );
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Не удалось выполнить операцию');
  }
  return 'Не удалось выполнить операцию';
};

const makeLocalId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toShiftSyncState = (shift: Partial<ShiftBase>): ShiftCacheSyncState => {
  if (shift.sync_state === 'error' || shift.sync_error) return 'error';
  if (shift.sync_state === 'pending' || shift.is_pending) return 'pending';
  return 'synced';
};

const normalizeCachedShift = (shift: ShiftBase): ShiftBase => {
  const syncState = toShiftSyncState(shift);
  return {
    ...shift,
    sync_state: syncState,
    is_pending: syncState !== 'synced',
    sync_error: shift.sync_error ?? null,
  };
};

const sortShifts = (rows: ShiftBase[]) =>
  rows
    .map(normalizeCachedShift)
    .sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`));

const loadAllCachedShifts = async (): Promise<Record<string, ShiftBase[]>> => {
  const raw = await AsyncStorage.getItem(OFFLINE_SHIFTS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<Record<string, ShiftBase[]>>((acc, [userId, rows]) => {
      acc[userId] = Array.isArray(rows) ? sortShifts(rows as ShiftBase[]) : [];
      return acc;
    }, {});
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
    return Array.isArray(parsed) ? (parsed as QueueOp[]) : [];
  } catch {
    return [];
  }
};

const saveQueue = async (ops: QueueOp[]) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(ops));
};

const getUserShifts = async (userId: string): Promise<ShiftBase[]> => {
  const all = await loadAllCachedShifts();
  return sortShifts(all[userId] || []);
};

const setUserShifts = async (userId: string, shifts: ShiftBase[]) => {
  const all = await loadAllCachedShifts();
  all[userId] = sortShifts(shifts);
  await saveAllCachedShifts(all);
};

const upsertInCache = (rows: ShiftBase[], next: ShiftBase): ShiftBase[] => {
  const normalized = normalizeCachedShift(next);
  const without = rows.filter((item) => item.id !== normalized.id);
  return sortShifts([normalized, ...without]);
};

const patchInCache = (rows: ShiftBase[], id: string, patch: Partial<ShiftBase>): ShiftBase[] =>
  sortShifts(
    rows.map((item) =>
      item.id === id
        ? normalizeCachedShift({
            ...item,
            ...patch,
          } as ShiftBase)
        : item
    )
  );

const markShiftPending = (rows: ShiftBase[], id: string, patch?: Partial<ShiftBase>) =>
  patchInCache(rows, id, {
    ...patch,
    sync_state: 'pending',
    sync_error: null,
    is_pending: true,
  });

const markShiftSynced = (rows: ShiftBase[], id: string, patch?: Partial<ShiftBase>) =>
  patchInCache(rows, id, {
    ...patch,
    sync_state: 'synced',
    sync_error: null,
    is_pending: false,
  });

const markShiftError = (rows: ShiftBase[], id: string, message: string) =>
  patchInCache(rows, id, {
    sync_state: 'error',
    sync_error: message,
    is_pending: true,
  });

const mergeServerRowsWithLocalRows = (serverRows: ShiftBase[], localRows: ShiftBase[]) => {
  const merged = new Map<string, ShiftBase>();

  serverRows.forEach((row) => {
    merged.set(
      row.id,
      normalizeCachedShift({
        ...row,
        sync_state: 'synced',
        sync_error: null,
        is_pending: false,
      })
    );
  });

  localRows.forEach((row) => {
    const normalized = normalizeCachedShift(row);
    if (normalized.sync_state !== 'synced' || !merged.has(normalized.id)) {
      merged.set(normalized.id, normalized);
    }
  });

  return sortShifts([...merged.values()]);
};

const enqueueShiftOperation = async (userId: string, op: QueueOp): Promise<{ dropped: boolean }> => {
  const queue = await loadQueue();
  const ownQueue = queue.filter((item) => item.user_id === userId);
  const otherQueue = queue.filter((item) => item.user_id !== userId);

  const withoutSameShift = ownQueue.filter((item) => item.shift_id !== op.shift_id);
  const existingCreate = ownQueue.find((item) => item.shift_id === op.shift_id && item.type === 'create');
  const existingUpdate = ownQueue.find((item) => item.shift_id === op.shift_id && item.type === 'update');

  if (op.type === 'update' && existingCreate) {
    const mergedCreate: QueueOp = {
      ...existingCreate,
      payload: {
        ...(existingCreate.payload || {}),
        ...(op.payload || {}),
      },
      last_error: null,
    };
    await saveQueue([...withoutSameShift, mergedCreate, ...otherQueue]);
    return { dropped: false };
  }

  if (op.type === 'update' && existingUpdate) {
    const mergedUpdate: QueueOp = {
      ...existingUpdate,
      payload: {
        ...(existingUpdate.payload || {}),
        ...(op.payload || {}),
      },
      created_at: op.created_at,
      last_error: null,
    };
    await saveQueue([...withoutSameShift, mergedUpdate, ...otherQueue]);
    return { dropped: false };
  }

  if (op.type === 'delete' && existingCreate) {
    await saveQueue([...withoutSameShift, ...otherQueue]);
    return { dropped: true };
  }

  const nextOwnQueue =
    op.type === 'delete'
      ? [...withoutSameShift, op]
      : [...withoutSameShift, op];

  await saveQueue([...nextOwnQueue, ...otherQueue]);
  return { dropped: false };
};

const updateSyncStateFromQueue = async (userId: string, next?: Partial<ReturnType<typeof getShiftSyncState>>) => {
  const pendingCount = await getPendingOpsCount(userId);
  const current = getShiftSyncState();
  const preserveError = current.status === 'error' && pendingCount > 0 && !next;

  setShiftSyncState({
    pendingCount,
    status: preserveError ? 'error' : pendingCount > 0 ? 'unsynced' : 'synced',
    lastError: pendingCount > 0 ? current.lastError : null,
    ...(next || {}),
  });
};

export const getPendingOpsCount = async (userId: string): Promise<number> => {
  const queue = await loadQueue();
  return queue.filter((item) => item.user_id === userId).length;
};

export const getCachedShifts = async (userId: string): Promise<ShiftBase[]> => {
  if (!userId) return [];
  return getUserShifts(userId);
};

export const refreshUserShiftsCache = async (userId: string): Promise<ShiftBase[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  const cache = await getUserShifts(userId);
  const merged = mergeServerRowsWithLocalRows((data || []) as ShiftBase[], cache);
  await setUserShifts(userId, merged);
  return merged;
};

export const syncPendingShiftOps = async (userId: string): Promise<PendingShiftSyncResult> => {
  const queue = await loadQueue();
  const ownQueue = queue.filter((item) => item.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const otherUsers = queue.filter((item) => item.user_id !== userId);

  if (ownQueue.length === 0) {
    return { ok: true, synced: 0, pending: 0, networkUnavailable: false, errorMessage: null };
  }

  let synced = 0;
  let cache = await getUserShifts(userId);

  for (let index = 0; index < ownQueue.length; index += 1) {
    const op = ownQueue[index];

    try {
      if (op.type === 'create') {
        const payload = sanitizeShiftPayloadForServer({ ...(op.payload as Record<string, unknown>) });

        const { data, error } = await supabase
          .from('shifts')
          .insert([payload])
          .select('*')
          .single();

        if (error) throw error;

        const serverId = String(data.id);
        for (let i = index + 1; i < ownQueue.length; i += 1) {
          if (ownQueue[i].shift_id === op.shift_id) {
            ownQueue[i] = {
              ...ownQueue[i],
              shift_id: serverId,
            };
          }
        }

        cache = cache.filter((row) => row.id !== op.shift_id);
        cache = upsertInCache(cache, {
          ...(data as ShiftBase),
          sync_state: 'synced',
          sync_error: null,
          is_pending: false,
        });
        await setUserShifts(userId, cache);
      }

      if (op.type === 'update') {
        const payload = sanitizeShiftPayloadForServer({ ...(op.payload as Record<string, unknown>) });
        const { error } = await supabase
          .from('shifts')
          .update(payload)
          .eq('id', op.shift_id)
          .eq('user_id', userId);

        if (error) throw error;

        cache = markShiftSynced(cache, op.shift_id, op.payload);
        await setUserShifts(userId, cache);
      }

      if (op.type === 'delete') {
        const { error } = await supabase
          .from('shifts')
          .delete()
          .eq('id', op.shift_id)
          .eq('user_id', userId);

        if (error) throw error;

        cache = cache.filter((row) => row.id !== op.shift_id);
        await setUserShifts(userId, cache);
      }

      synced += 1;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const remainingOwn = ownQueue.slice(index).map((item, itemIndex) =>
        itemIndex === 0
          ? {
              ...item,
              last_error: errorMessage,
            }
          : item
      );

      await saveQueue([...remainingOwn, ...otherUsers]);

      if (isNetworkError(error)) {
        return {
          ok: false,
          synced,
          pending: remainingOwn.length,
          networkUnavailable: true,
          errorMessage,
        };
      }

      if (op.type !== 'delete') {
        cache = markShiftError(cache, op.shift_id, errorMessage);
        await setUserShifts(userId, cache);
      }

      return {
        ok: false,
        synced,
        pending: remainingOwn.length,
        networkUnavailable: false,
        errorMessage,
      };
    }
  }

  await saveQueue(otherUsers);
  return {
    ok: true,
    synced,
    pending: 0,
    networkUnavailable: false,
    errorMessage: null,
  };
};

export const getShiftsWithOffline = async (params: {
  userId: string;
  start: string;
  end: string;
}): Promise<{ shifts: ShiftBase[]; fromCache: boolean; pendingCount: number }> => {
  if (!params.userId) {
    return { shifts: [], fromCache: true, pendingCount: 0 };
  }

  const cachedAll = await getUserShifts(params.userId);
  const cachedRange = cachedAll.filter((row) => row.date >= params.start && row.date <= params.end);

  let syncResult: PendingShiftSyncResult | null = null;
  try {
    syncResult = await syncPendingShiftOps(params.userId);
  } catch {
    syncResult = null;
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', params.userId)
      .gte('date', params.start)
      .lte('date', params.end)
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const latestCache = await getUserShifts(params.userId);
    const outsideRange = latestCache.filter((row) => row.date < params.start || row.date > params.end);
    const localRange = latestCache.filter((row) => row.date >= params.start && row.date <= params.end);
    const mergedRange = mergeServerRowsWithLocalRows((data || []) as ShiftBase[], localRange);
    await setUserShifts(params.userId, [...outsideRange, ...mergedRange]);

    const pendingCount = await getPendingOpsCount(params.userId);
    setShiftSyncState({
      pendingCount,
      status:
        syncResult && !syncResult.ok && !syncResult.networkUnavailable
          ? 'error'
          : pendingCount > 0
            ? 'unsynced'
            : 'synced',
      lastError: syncResult && !syncResult.ok && !syncResult.networkUnavailable ? syncResult.errorMessage : null,
      lastSyncedAt: new Date().toISOString(),
    });

    return {
      shifts: mergedRange,
      fromCache: false,
      pendingCount,
    };
  } catch {
    const pendingCount = await getPendingOpsCount(params.userId);
    if (pendingCount > 0) {
      setShiftSyncState({
        pendingCount,
        status: getShiftSyncState().status === 'error' ? 'error' : 'unsynced',
      });
    }

    return {
      shifts: cachedRange,
      fromCache: true,
      pendingCount,
    };
  }
};

export const getAllShiftsOfflineAware = async (userId: string): Promise<{ shifts: ShiftBase[]; fromCache: boolean; pendingCount: number }> => {
  if (!userId) {
    return { shifts: [], fromCache: true, pendingCount: 0 };
  }

  const cached = await getUserShifts(userId);

  try {
    const syncResult = await syncPendingShiftOps(userId);
    const refreshed = await refreshUserShiftsCache(userId);
    const pendingCount = await getPendingOpsCount(userId);

    setShiftSyncState({
      pendingCount,
      status:
        syncResult.ok
          ? pendingCount > 0
            ? 'unsynced'
            : 'synced'
          : syncResult.networkUnavailable
            ? pendingCount > 0
              ? 'unsynced'
              : 'synced'
            : 'error',
      lastError: syncResult.ok || syncResult.networkUnavailable ? null : syncResult.errorMessage,
      lastSyncedAt: syncResult.ok ? new Date().toISOString() : getShiftSyncState().lastSyncedAt,
    });

    return {
      shifts: refreshed,
      fromCache: false,
      pendingCount,
    };
  } catch {
    const pendingCount = await getPendingOpsCount(userId);
    return {
      shifts: cached,
      fromCache: true,
      pendingCount,
    };
  }
};

export const getUpcomingShiftOfflineAware = async (
  userId: string,
  fromDate: string = new Date().toISOString().slice(0, 10)
): Promise<{ shift: ShiftBase | null; fromCache: boolean; pendingCount: number }> => {
  const payload = await getAllShiftsOfflineAware(userId);
  const nextShift =
    payload.shifts
      .filter((shift) => shift.date >= fromDate)
      .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))[0] || null;

  return {
    shift: nextShift,
    fromCache: payload.fromCache,
    pendingCount: payload.pendingCount,
  };
};

export const getShiftByIdOffline = async (userId: string, shiftId: string): Promise<ShiftBase | null> => {
  const rows = await getUserShifts(userId);
  return rows.find((row) => row.id === shiftId) || null;
};

export const saveShiftOfflineAware = async (params: {
  userId: string;
  isEdit: boolean;
  shiftId?: string;
  shiftData: Omit<ShiftBase, 'id' | 'is_pending' | 'sync_state' | 'sync_error'>;
}): Promise<{ queued: boolean; shiftId: string }> => {
  if (!params.userId) {
    throw new Error('Пользователь не авторизован');
  }

  const cache = await getUserShifts(params.userId);

  if (params.isEdit && params.shiftId) {
    try {
      const { error } = await supabase
        .from('shifts')
        .update(sanitizeShiftPayloadForServer(params.shiftData as Record<string, unknown>))
        .eq('id', params.shiftId)
        .eq('user_id', params.userId);

      if (error) throw error;

      await setUserShifts(params.userId, markShiftSynced(cache, params.shiftId, params.shiftData));
      await updateSyncStateFromQueue(params.userId, { lastError: null });
      return { queued: false, shiftId: params.shiftId };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      const op: QueueOp = {
        id: makeLocalId(),
        user_id: params.userId,
        type: 'update',
        shift_id: params.shiftId,
        payload: {
          ...params.shiftData,
          sync_state: 'pending',
          sync_error: null,
          is_pending: true,
        },
        created_at: new Date().toISOString(),
      };

      await enqueueShiftOperation(params.userId, op);
      await setUserShifts(params.userId, markShiftPending(cache, params.shiftId, params.shiftData));
      await updateSyncStateFromQueue(params.userId, { status: 'unsynced', lastError: null });
      return { queued: true, shiftId: params.shiftId };
    }
  }

  const tempId = makeLocalId();
  const optimisticShift: ShiftBase = normalizeCachedShift({
    id: tempId,
    ...params.shiftData,
    sync_state: 'pending',
    sync_error: null,
    is_pending: true,
  });

  try {
    const { data, error } = await supabase
      .from('shifts')
      .insert([sanitizeShiftPayloadForServer(params.shiftData as Record<string, unknown>)])
      .select('*')
      .single();

    if (error) throw error;

    await setUserShifts(
      params.userId,
      upsertInCache(cache, {
        ...(data as ShiftBase),
        sync_state: 'synced',
        sync_error: null,
        is_pending: false,
      })
    );
    await updateSyncStateFromQueue(params.userId, { lastError: null });
    return { queued: false, shiftId: String(data.id) };
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

    await enqueueShiftOperation(params.userId, op);
    await setUserShifts(params.userId, upsertInCache(cache, optimisticShift));
    await updateSyncStateFromQueue(params.userId, { status: 'unsynced', lastError: null });
    return { queued: true, shiftId: tempId };
  }
};

export const deleteShiftOfflineAware = async (params: {
  userId: string;
  shiftId: string;
}): Promise<{ queued: boolean }> => {
  if (!params.userId) {
    throw new Error('Пользователь не авторизован');
  }

  const cache = await getUserShifts(params.userId);

  try {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', params.shiftId)
      .eq('user_id', params.userId);

    if (error) throw error;
    await setUserShifts(params.userId, cache.filter((row) => row.id !== params.shiftId));
    await updateSyncStateFromQueue(params.userId, { lastError: null });
    return { queued: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;

    const op: QueueOp = {
      id: makeLocalId(),
      user_id: params.userId,
      type: 'delete',
      shift_id: params.shiftId,
      created_at: new Date().toISOString(),
    };

    const enqueueResult = await enqueueShiftOperation(params.userId, op);
    await setUserShifts(params.userId, cache.filter((row) => row.id !== params.shiftId));

    if (enqueueResult.dropped) {
      await updateSyncStateFromQueue(params.userId, { lastError: null });
      return { queued: false };
    }

    await updateSyncStateFromQueue(params.userId, { status: 'unsynced', lastError: null });
    return { queued: true };
  }
};
