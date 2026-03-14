import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { calculateEarnings } from '@/utils/calculations';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { deleteShiftOfflineAware, getShiftsWithOffline, saveShiftOfflineAware } from '@/services/offlineShifts';
import { supabase } from '@/services/supabase/client';

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
    created_at: string;
    updated_at: string;
}

interface UseShiftsReturn {
    shifts: Shift[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    fetchShifts: (date?: Date) => Promise<void>;
    addShift: (shiftData: Omit<Shift, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Shift | null>;
    updateShift: (id: string, shiftData: Partial<Shift>) => Promise<boolean>;
    deleteShift: (id: string) => Promise<boolean>;
    getShiftsByDate: (date: string) => Shift[];
    getMonthlySummary: (date: Date) => { totalEarnings: number; totalHours: number; shiftCount: number };
    refreshShifts: () => Promise<void>;
}

export function useShifts(userId?: string) {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchShifts = useCallback(async (date?: Date) => {
        try {
            setLoading(true);
            setError(null);

            const resolvedUserId = userId || (await supabase.auth.getSession()).data.session?.user?.id;
            if (!resolvedUserId) throw new Error('Пользователь не авторизован');

            const targetDate = date || new Date();
            const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');
            const payload = await getShiftsWithOffline({ userId: resolvedUserId, start, end });
            setShifts(payload.shifts as Shift[]);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching shifts:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const addShift = useCallback(async (
        shiftData: Omit<Shift, 'id' | 'user_id' | 'created_at' | 'updated_at'>
    ): Promise<Shift | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            const earnings = calculateEarnings(
                shiftData.start_time,
                shiftData.end_time,
                shiftData.hourly_rate,
                shiftData.extra_payment
            );

            const newShift = {
                ...shiftData,
                user_id: user.id,
                earnings,
            };

            const result = await saveShiftOfflineAware({
                userId: user.id,
                isEdit: false,
                shiftData: newShift,
            });

            const cached = {
                id: result.shiftId,
                ...newShift,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Shift;

            setShifts(prev => [cached, ...prev]);
            return cached;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return null;
        }
    }, []);

    const updateShift = useCallback(async (
        id: string,
        shiftData: Partial<Shift>
    ): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            // Пересчитываем заработок если изменилось время или ставка
            if (shiftData.start_time || shiftData.end_time || shiftData.hourly_rate || shiftData.extra_payment) {
                const existingShift = shifts.find(s => s.id === id);
                if (existingShift) {
                    const earnings = calculateEarnings(
                        shiftData.start_time || existingShift.start_time,
                        shiftData.end_time || existingShift.end_time,
                        shiftData.hourly_rate || existingShift.hourly_rate,
                        shiftData.extra_payment ?? existingShift.extra_payment
                    );
                    shiftData.earnings = earnings;
                }
            }

            await saveShiftOfflineAware({
                userId: user.id,
                isEdit: true,
                shiftId: id,
                shiftData: {
                    ...shiftData,
                    user_id: user.id,
                } as any,
            });

            setShifts(prev => prev.map(shift =>
                shift.id === id ? { ...shift, ...shiftData } : shift
            ));
            return true;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return false;
        }
    }, [shifts]);

    const deleteShift = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            await deleteShiftOfflineAware({ userId: user.id, shiftId: id });

            setShifts(prev => prev.filter(shift => shift.id !== id));
            return true;
        } catch (err: any) {
            Alert.alert('Ошибка', err.message);
            return false;
        }
    }, []);

    const getShiftsByDate = useCallback((date: string): Shift[] => {
        return shifts.filter(shift => shift.date === date);
    }, [shifts]);

    const getMonthlySummary = useCallback((date: Date) => {
        const monthShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shiftDate.getMonth() === date.getMonth() &&
                shiftDate.getFullYear() === date.getFullYear();
        });

        const totalEarnings = monthShifts.reduce((sum, shift) => sum + shift.earnings, 0);
        const totalHours = monthShifts.reduce((sum, shift) => {
            const [startH, startM] = shift.start_time.split(':').map(Number);
            const [endH, endM] = shift.end_time.split(':').map(Number);
            let hours = endH - startH;
            let minutes = endM - startM;
            if (minutes < 0) {
                hours -= 1;
                minutes += 60;
            }
            return sum + hours + (minutes / 60);
        }, 0);
        const shiftCount = monthShifts.length;

        return { totalEarnings, totalHours, shiftCount };
    }, [shifts]);

    const refreshShifts = useCallback(async () => {
        try {
            setRefreshing(true);
            await fetchShifts();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    }, [fetchShifts]);

    useEffect(() => {
        if (userId) {
            fetchShifts();
        }
    }, [userId, fetchShifts]);

    return {
        shifts,
        loading,
        refreshing,
        error,
        fetchShifts,
        addShift,
        updateShift,
        deleteShift,
        getShiftsByDate,
        getMonthlySummary,
        refreshShifts,
    };
}
