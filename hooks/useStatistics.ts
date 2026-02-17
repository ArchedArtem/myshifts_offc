import { useState, useCallback } from 'react';
import { supabase } from '@/services/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns';

interface MonthlyStat {
    month: string;
    earnings: number;
    hours: number;
    shifts: number;
    averagePerHour: number;
}

interface YearlyStats {
    totalEarnings: number;
    totalHours: number;
    totalShifts: number;
    averagePerShift: number;
    averagePerHour: number;
    monthlyStats: MonthlyStat[];
    bestMonth: MonthlyStat | null;
}

interface UseStatisticsReturn {
    loading: boolean;
    yearlyStats: YearlyStats | null;
    fetchYearlyStats: (year?: number) => Promise<void>;
    getMonthStats: (date: Date) => Promise<MonthlyStat>;
    getShiftStats: () => Promise<{
        averageDuration: number;
        mostCommonStartTime: string;
        mostCommonEndTime: string;
    }>;
}

export function useStatistics() {
    const [loading, setLoading] = useState(false);
    const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null);

    const fetchYearlyStats = useCallback(async (year?: number) => {
        try {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            const targetYear = year || new Date().getFullYear();
            const startDate = `${targetYear}-01-01`;
            const endDate = `${targetYear}-12-31`;

            const { data, error } = await supabase
                .from('shifts')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date');

            if (error) throw error;

            const shifts = data || [];

            // Группируем по месяцам
            const monthlyData: { [key: string]: MonthlyStat } = {};

            shifts.forEach(shift => {
                const month = shift.date.substring(0, 7); // YYYY-MM
                const duration = calculateDuration(shift.start_time, shift.end_time);

                if (!monthlyData[month]) {
                    monthlyData[month] = {
                        month: format(new Date(shift.date + 'T00:00:00'), 'MMM yyyy'),
                        earnings: 0,
                        hours: 0,
                        shifts: 0,
                        averagePerHour: 0,
                    };
                }

                monthlyData[month].earnings += shift.earnings;
                monthlyData[month].hours += duration;
                monthlyData[month].shifts += 1;
            });

            // Рассчитываем средние значения
            const monthlyStats = Object.values(monthlyData).map(stat => ({
                ...stat,
                averagePerHour: stat.hours > 0 ? stat.earnings / stat.hours : 0,
            }));

            // Общая статистика за год
            const totalEarnings = monthlyStats.reduce((sum, stat) => sum + stat.earnings, 0);
            const totalHours = monthlyStats.reduce((sum, stat) => sum + stat.hours, 0);
            const totalShifts = monthlyStats.reduce((sum, stat) => sum + stat.shifts, 0);
            const averagePerShift = totalShifts > 0 ? totalEarnings / totalShifts : 0;
            const averagePerHour = totalHours > 0 ? totalEarnings / totalHours : 0;

            // Лучший месяц по заработку
            const bestMonth = monthlyStats.length > 0
                ? monthlyStats.reduce((best, current) =>
                    current.earnings > best.earnings ? current : best
                )
                : null;

            setYearlyStats({
                totalEarnings,
                totalHours,
                totalShifts,
                averagePerShift,
                averagePerHour,
                monthlyStats: monthlyStats.sort((a, b) => {
                    const [aMonth, aYear] = a.month.split(' ');
                    const [bMonth, bYear] = b.month.split(' ');
                    if (aYear !== bYear) return bYear.localeCompare(aYear);
                    return new Date(`01 ${bMonth} ${bYear}`).getTime() -
                        new Date(`01 ${aMonth} ${aYear}`).getTime();
                }),
                bestMonth,
            });
        } catch (error) {
            console.error('Error fetching yearly stats:', error);
            setYearlyStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const getMonthStats = useCallback(async (date: Date): Promise<MonthlyStat> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            const start = format(startOfMonth(date), 'yyyy-MM-dd');
            const end = format(endOfMonth(date), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('shifts')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', start)
                .lte('date', end);

            if (error) throw error;

            const shifts = data || [];
            const earnings = shifts.reduce((sum, shift) => sum + shift.earnings, 0);
            const hours = shifts.reduce((sum, shift) =>
                sum + calculateDuration(shift.start_time, shift.end_time), 0);
            const shiftCount = shifts.length;

            return {
                month: format(date, 'MMM yyyy'),
                earnings,
                hours,
                shifts: shiftCount,
                averagePerHour: hours > 0 ? earnings / hours : 0,
            };
        } catch (error) {
            console.error('Error fetching month stats:', error);
            throw error;
        }
    }, []);

    const getShiftStats = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не авторизован');

            const { data, error } = await supabase
                .from('shifts')
                .select('start_time, end_time')
                .eq('user_id', user.id)
                .limit(1000);

            if (error) throw error;

            const shifts = data || [];

            if (shifts.length === 0) {
                return {
                    averageDuration: 0,
                    mostCommonStartTime: '09:00',
                    mostCommonEndTime: '17:00',
                };
            }

            // Средняя продолжительность смены
            let totalDuration = 0;
            shifts.forEach(shift => {
                totalDuration += calculateDuration(shift.start_time, shift.end_time);
            });
            const averageDuration = totalDuration / shifts.length;

            // Самое частое время начала
            const startTimeCounts: { [key: string]: number } = {};
            shifts.forEach(shift => {
                const roundedStart = roundToNearest15(shift.start_time);
                startTimeCounts[roundedStart] = (startTimeCounts[roundedStart] || 0) + 1;
            });

            // Самое частое время окончания
            const endTimeCounts: { [key: string]: number } = {};
            shifts.forEach(shift => {
                const roundedEnd = roundToNearest15(shift.end_time);
                endTimeCounts[roundedEnd] = (endTimeCounts[roundedEnd] || 0) + 1;
            });

            const mostCommonStartTime = Object.keys(startTimeCounts).reduce((a, b) =>
                startTimeCounts[a] > startTimeCounts[b] ? a : b
            );

            const mostCommonEndTime = Object.keys(endTimeCounts).reduce((a, b) =>
                endTimeCounts[a] > endTimeCounts[b] ? a : b
            );

            return {
                averageDuration,
                mostCommonStartTime,
                mostCommonEndTime,
            };
        } catch (error) {
            console.error('Error fetching shift stats:', error);
            throw error;
        }
    }, []);

    // Вспомогательные функции
    const calculateDuration = (startTime: string, endTime: string): number => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        let hours = endH - startH;
        let minutes = endM - startM;

        if (minutes < 0) {
            hours -= 1;
            minutes += 60;
        }

        return hours + (minutes / 60);
    };

    const roundToNearest15 = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number);
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const newHours = roundedMinutes === 60 ? hours + 1 : hours;
        const newMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;

        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    };

    return {
        loading,
        yearlyStats,
        fetchYearlyStats,
        getMonthStats,
        getShiftStats,
    };
}