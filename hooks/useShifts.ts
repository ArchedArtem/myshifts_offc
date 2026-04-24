import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { calculateEarnings } from '@/utils/calculations';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { deleteShiftOfflineAware, getShiftsWithOffline, saveShiftOfflineAware, getCachedShifts } from '@/services/offlineShifts';
import { useAuth } from '@/hooks/useAuth';

interface Shift {
    id: string;
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    extra_payment: number;
    earnings: number;
    notes?: string;
    break?: number;
    created_at: string;
    updated_at: string;
}

export function useShifts(providedUserId?: string) {
    const { user } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchShifts = useCallback(async (date?: Date, isRefresh: boolean = false) => {
        const resolvedUserId = providedUserId || user?.id;
        if (!resolvedUserId) {
            setLoading(false);
            return;
        }

        try {
            if (!isRefresh && shifts.length === 0) setLoading(true);
            setError(null);

            const targetDate = date || new Date();
            const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');

            const localCache = await getCachedShifts(resolvedUserId);
            const localRange = localCache.filter(s => s.date >= start && s.date <= end);
            setShifts(localRange as Shift[]);
            setLoading(false);

            const bgPromise = getShiftsWithOffline({ userId: resolvedUserId, start, end })
                .then(payload => setShifts(payload.shifts as Shift[]))
                .catch(() => {});

            if (isRefresh) await bgPromise;

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    }, [providedUserId, user?.id, shifts.length]);

    const addShift = useCallback(async (shiftData: Omit<Shift, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Shift | null> => {
        try {
            const resolvedUserId = providedUserId || user?.id;
            if (!resolvedUserId) throw new Error('Пользователь не авторизован');
            const earnings = calculateEarnings(shiftData.start_time, shiftData.end_time, shiftData.hourly_rate, shiftData.extra_payment);
            const newShift = { ...shiftData, user_id: resolvedUserId, earnings };
            const result = await saveShiftOfflineAware({ userId: resolvedUserId, isEdit: false, shiftData: newShift });
            const cached = { id: result.shiftId, ...newShift, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Shift;
            setShifts(prev => [cached, ...prev]);
            return cached;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return null;
        }
    }, [providedUserId, user?.id]);

    const updateShift = useCallback(async (id: string, shiftData: Partial<Shift>): Promise<boolean> => {
        try {
            const resolvedUserId = providedUserId || user?.id;
            if (!resolvedUserId) throw new Error('Пользователь не авторизован');

            if (shiftData.start_time || shiftData.end_time || shiftData.hourly_rate || shiftData.extra_payment) {
                const existingShift = shifts.find(s => s.id === id);
                if (existingShift) {
                    shiftData.earnings = calculateEarnings(
                        shiftData.start_time || existingShift.start_time, shiftData.end_time || existingShift.end_time,
                        shiftData.hourly_rate || existingShift.hourly_rate, shiftData.extra_payment ?? existingShift.extra_payment
                    );
                }
            }
            await saveShiftOfflineAware({ userId: resolvedUserId, isEdit: true, shiftId: id, shiftData: { ...shiftData, user_id: resolvedUserId } as any });
            setShifts(prev => prev.map(shift => shift.id === id ? { ...shift, ...shiftData } : shift));
            return true;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return false;
        }
    }, [shifts, providedUserId, user?.id]);

    const deleteShift = useCallback(async (id: string): Promise<boolean> => {
        try {
            const resolvedUserId = providedUserId || user?.id;
            if (!resolvedUserId) throw new Error('Пользователь не авторизован');
            await deleteShiftOfflineAware({ userId: resolvedUserId, shiftId: id });
            setShifts(prev => prev.filter(shift => shift.id !== id));
            return true;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return false;
        }
    }, [providedUserId, user?.id]);

    const getShiftsByDate = useCallback((date: string): Shift[] => shifts.filter(shift => shift.date === date), [shifts]);

    const getMonthlySummary = useCallback((date: Date) => {
        const monthShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shiftDate.getMonth() === date.getMonth() && shiftDate.getFullYear() === date.getFullYear();
        });
        const totalEarnings = monthShifts.reduce((sum, shift) => sum + shift.earnings, 0);
        const totalHours = monthShifts.reduce((sum, shift) => {
            const [startH, startM] = shift.start_time.split(':').map(Number);
            const [endH, endM] = shift.end_time.split(':').map(Number);
            let hours = endH - startH;
            let minutes = endM - startM;
            if (minutes < 0) { hours -= 1; minutes += 60; }
            return sum + hours + (minutes / 60);
        }, 0);
        return { totalEarnings, totalHours, shiftCount: monthShifts.length };
    }, [shifts]);

    const refreshShifts = useCallback(async () => {
        try {
            setRefreshing(true);
            await fetchShifts(undefined, true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    }, [fetchShifts]);

    useEffect(() => { fetchShifts(); }, [fetchShifts]);

    return { shifts, loading, refreshing, error, fetchShifts, addShift, updateShift, deleteShift, getShiftsByDate, getMonthlySummary, refreshShifts };
}