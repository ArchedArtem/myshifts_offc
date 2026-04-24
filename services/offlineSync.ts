import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getPendingOpsCount, refreshUserShiftsCache, syncPendingShiftOps } from '@/services/offlineShifts';
import { getShiftSyncState, resetShiftSyncState, setShiftSyncState, type ShiftSyncState } from '@/services/shiftSyncState';

type SyncOptions = {
  onSynced?: () => Promise<void> | void;
  forceRefreshCache?: boolean;
};

let activeUserId: string | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let netInfoSubscription: (() => void) | null = null; // Подписка на сеть
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

  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    const pendingBefore = await getPendingOpsCount(userId);
    setShiftSyncState({
      syncing: true,
      pendingCount: pendingBefore,
    });

    const result = await syncPendingShiftOps(userId);

    if (result.ok) {
      const shouldRefreshCache = options?.forceRefreshCache || pendingBefore > 0 || !getShiftSyncState().lastSyncedAt;
      if (shouldRefreshCache) {
        try {
          await refreshUserShiftsCache(userId);
        } catch (e) {}
      }

      const pendingAfter = await getPendingOpsCount(userId);
      setShiftSyncState({
        syncing: false,
        pendingCount: pendingAfter,
        status: pendingAfter > 0 ? 'unsynced' : 'synced',
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
      });

      if (pendingAfter === 0 && (options?.forceRefreshCache || pendingBefore > 0)) {
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
      lastError: result.errorMessage || 'Ошибка синхронизации',
    });
    return getShiftSyncState();
  })().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
};

export const stopShiftSyncEngine = () => {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
  appStateSubscription?.remove();
  appStateSubscription = null;

  if (netInfoSubscription) netInfoSubscription(); // Отписываемся от сети
  netInfoSubscription = null;

  activeUserId = null;
  resetShiftSyncState();
};

export const startShiftSyncEngine = (userId: string, options?: SyncOptions) => {
  stopShiftSyncEngine();
  if (!userId) return () => {};

  activeUserId = userId;

  refreshShiftSyncState(userId).catch(() => {});
  syncNow(userId, options).catch(() => {});

  syncInterval = setInterval(() => {
    if (activeUserId) syncNow(activeUserId, options).catch(() => {});
  }, SYNC_INTERVAL_MS);

  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active' && activeUserId) syncNow(activeUserId, options).catch(() => {});
  });

  netInfoSubscription = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable && activeUserId) {
      syncNow(activeUserId, options).catch(() => {});
    }
  });

  return () => stopShiftSyncEngine();
};