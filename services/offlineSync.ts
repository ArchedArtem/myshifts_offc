import { AppState, type AppStateStatus } from 'react-native';
import { getPendingOpsCount, refreshUserShiftsCache, syncPendingShiftOps } from '@/services/offlineShifts';
import { getShiftSyncState, resetShiftSyncState, setShiftSyncState, type ShiftSyncState } from '@/services/shiftSyncState';

type SyncOptions = {
  onSynced?: () => Promise<void> | void;
  forceRefreshCache?: boolean;
};

let activeUserId: string | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let inFlightSync: Promise<ShiftSyncState> | null = null;

const SYNC_INTERVAL_MS = 60000;

export const refreshShiftSyncState = async (userId?: string | null): Promise<ShiftSyncState> => {
  if (!userId) {
    resetShiftSyncState();
    return getShiftSyncState();
  }

  const pendingCount = await getPendingOpsCount(userId);
  const current = getShiftSyncState();

  setShiftSyncState({
    pendingCount,
    status: current.status === 'error' && pendingCount > 0 ? 'error' : pendingCount > 0 ? 'unsynced' : 'synced',
    lastError: pendingCount > 0 ? current.lastError : null,
  });

  return getShiftSyncState();
};

export const syncNow = async (userId: string, options?: SyncOptions): Promise<ShiftSyncState> => {
  if (!userId) {
    resetShiftSyncState();
    return getShiftSyncState();
  }

  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async () => {
    const pendingBefore = await getPendingOpsCount(userId);
    setShiftSyncState({
      syncing: true,
      pendingCount: pendingBefore,
      status: getShiftSyncState().status === 'error' && pendingBefore > 0 ? 'error' : pendingBefore > 0 ? 'unsynced' : 'synced',
    });

    const result = await syncPendingShiftOps(userId);

    if (result.ok) {
      const shouldRefreshCache = options?.forceRefreshCache || pendingBefore > 0 || !getShiftSyncState().lastSyncedAt;
      const shouldRunOnSyncedCallback = options?.forceRefreshCache || pendingBefore > 0;
      if (shouldRefreshCache) {
        try {
          await refreshUserShiftsCache(userId);
        } catch {
          // Не блокируем успешную синхронизацию очереди, если не удалось сразу обновить кэш.
        }
      }

      const pendingAfter = await getPendingOpsCount(userId);
      setShiftSyncState({
        syncing: false,
        pendingCount: pendingAfter,
        status: pendingAfter > 0 ? 'unsynced' : 'synced',
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
      });

      if (pendingAfter === 0 && shouldRunOnSyncedCallback) {
        await options?.onSynced?.();
      }

      return getShiftSyncState();
    }

    if (result.networkUnavailable) {
      setShiftSyncState({
        syncing: false,
        pendingCount: result.pending,
        status: result.pending > 0 ? 'unsynced' : 'synced',
      });
      return getShiftSyncState();
    }

    setShiftSyncState({
      syncing: false,
      pendingCount: result.pending,
      status: 'error',
      lastError: result.errorMessage || 'Не удалось синхронизировать изменения',
    });
    return getShiftSyncState();
  })().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
};

const handleAppStateChange = (nextState: AppStateStatus, userId: string, options?: SyncOptions) => {
  if (nextState === 'active') {
    syncNow(userId, options).catch(() => {
      // Состояние уже будет отражено в глобальном баннере.
    });
  }
};

export const stopShiftSyncEngine = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  appStateSubscription?.remove();
  appStateSubscription = null;
  activeUserId = null;
  resetShiftSyncState();
};

export const startShiftSyncEngine = (userId: string, options?: SyncOptions) => {
  stopShiftSyncEngine();

  if (!userId) {
    return () => {};
  }

  activeUserId = userId;

  refreshShiftSyncState(userId).catch(() => {
    // Ничего не делаем: стартуем движок даже если очередь пока не прочиталась.
  });

  syncNow(userId, options).catch(() => {
    // Ошибка отражается через global state.
  });

  syncInterval = setInterval(() => {
    if (!activeUserId) return;
    syncNow(activeUserId, options).catch(() => {
      // Состояние обновится внутри syncNow.
    });
  }, SYNC_INTERVAL_MS);

  appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (!activeUserId) return;
    handleAppStateChange(nextState, activeUserId, options);
  });

  return () => {
    stopShiftSyncEngine();
  };
};
