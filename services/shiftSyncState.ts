export type ShiftSyncStatus = 'synced' | 'unsynced' | 'error';

export interface ShiftSyncState {
  status: ShiftSyncStatus;
  pendingCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const defaultShiftSyncState: ShiftSyncState = {
  status: 'synced',
  pendingCount: 0,
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
};

type ShiftSyncListener = (state: ShiftSyncState) => void;

let currentShiftSyncState: ShiftSyncState = defaultShiftSyncState;
const listeners = new Set<ShiftSyncListener>();

const emitShiftSyncState = () => {
  listeners.forEach((listener) => listener(currentShiftSyncState));
};

export const getShiftSyncState = () => currentShiftSyncState;

export const setShiftSyncState = (next: Partial<ShiftSyncState>) => {
  currentShiftSyncState = {
    ...currentShiftSyncState,
    ...next,
  };
  emitShiftSyncState();
};

export const resetShiftSyncState = () => {
  currentShiftSyncState = defaultShiftSyncState;
  emitShiftSyncState();
};

export const subscribeShiftSyncState = (listener: ShiftSyncListener) => {
  listeners.add(listener);
  listener(currentShiftSyncState);

  return () => {
    listeners.delete(listener);
  };
};
