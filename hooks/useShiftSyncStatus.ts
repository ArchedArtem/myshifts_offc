import { useEffect, useState } from 'react';
import { getShiftSyncState, subscribeShiftSyncState, type ShiftSyncState } from '@/services/shiftSyncState';

export const useShiftSyncStatus = (): ShiftSyncState => {
  const [state, setState] = useState<ShiftSyncState>(getShiftSyncState());

  useEffect(() => subscribeShiftSyncState(setState), []);

  return state;
};
