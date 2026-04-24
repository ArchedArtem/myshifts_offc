import { useState, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getAllShiftsOfflineAware, getCachedShifts } from '@/services/offlineShifts';
import { useAuth } from '@/hooks/useAuth';

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

export function useStatistics() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null);

    const calculateDuration = (startTime: string, endTime: string): number => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let hours = endH - startH;
        let minutes = endM - startM;
        if (minutes < 0) { hours -= 1; minutes += 60; }
        return hours + (minutes / 60);
    };

    const roundToNearest15 = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number);
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const newHours = roundedMinutes === 60 ? hours + 1 : hours;
        const newMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    };

    const processAndSetYearlyStats = (shifts: any[]) => {
        const monthlyData: { [key: string]: MonthlyStat } = {};

        shifts.forEach(shift => {
            const month = shift.date.substring(0, 7);
            const duration = calculateDuration(shift.start_time, shift.end_time);

            if (!monthlyData[month]) {
                monthlyData[month] = { month: format(new Date(shift.date + 'T00:00:00'), 'MMM yyyy'), earnings: 0, hours: 0, shifts: 0, averagePerHour: 0 };
            }
            monthlyData[month].earnings += shift.earnings;
            monthlyData[month].hours += duration;
            monthlyData[month].shifts += 1;
        });

        const monthlyStats = Object.values(monthlyData).map(stat => ({ ...stat, averagePerHour: stat.hours > 0 ? stat.earnings / stat.hours : 0 }));
        const totalEarnings = monthlyStats.reduce((sum, stat) => sum + stat.earnings, 0);
        const totalHours = monthlyStats.reduce((sum, stat) => sum + stat.hours, 0);
        const totalShifts = monthlyStats.reduce((sum, stat) => sum + stat.shifts, 0);

        setYearlyStats({
            totalEarnings, totalHours, totalShifts,
            averagePerShift: totalShifts > 0 ? totalEarnings / totalShifts : 0,
            averagePerHour: totalHours > 0 ? totalEarnings / totalHours : 0,
            monthlyStats: monthlyStats.sort((a, b) => {
                const [aMonth, aYear] = a.month.split(' ');
                const [bMonth, bYear] = b.month.split(' ');
                if (aYear !== bYear) return bYear.localeCompare(aYear);
                return new Date(`01 ${bMonth} ${bYear}`).getTime() - new Date(`01 ${aMonth} ${aYear}`).getTime();
            }),
            bestMonth: monthlyStats.length > 0 ? monthlyStats.reduce((best, current) => current.earnings > best.earnings ? current : best) : null,
        });
    };

    const fetchYearlyStats = useCallback(async (year?: number, isRefresh: boolean = false) => {
        if (!user?.id) return;
        try {
            if (!isRefresh) setLoading(true);

            const targetYear = year || new Date().getFullYear();
            const startDate = `${targetYear}-01-01`;
            const endDate = `${targetYear}-12-31`;

            const cachedAll = await getCachedShifts(user.id);
            const cachedShifts = cachedAll.filter(shift => shift.date >= startDate && shift.date <= endDate);
            processAndSetYearlyStats(cachedShifts);
            setLoading(false);

            const bgPromise = getAllShiftsOfflineAware(user.id).then(({ shifts }) => {
                const serverShifts = shifts.filter((shift: any) => shift.date >= startDate && shift.date <= endDate);
                processAndSetYearlyStats(serverShifts);
            }).catch(() => {});

            if (isRefresh) await bgPromise;

        } catch (error) {
            setYearlyStats(null);
            setLoading(false);
        }
    }, [user?.id]);

    const getMonthStats = useCallback(async (date: Date): Promise<MonthlyStat> => {
        if (!user?.id) throw new Error('Пользователь не авторизован');
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        const allShifts = await getCachedShifts(user.id);
        const shifts = allShifts.filter(shift => shift.date >= start && shift.date <= end);
        const earnings = shifts.reduce((sum, shift) => sum + shift.earnings, 0);
        const hours = shifts.reduce((sum, shift) => sum + calculateDuration(shift.start_time, shift.end_time), 0);
        return { month: format(date, 'MMM yyyy'), earnings, hours, shifts: shifts.length, averagePerHour: hours > 0 ? earnings / hours : 0 };
    }, [user?.id]);

    const getShiftStats = useCallback(async () => {
        if (!user?.id) throw new Error('Пользователь не авторизован');
        const allShifts = await getCachedShifts(user.id);
        const shifts = allShifts.slice(0, 1000);
        if (shifts.length === 0) return { averageDuration: 0, mostCommonStartTime: '09:00', mostCommonEndTime: '17:00' };

        let totalDuration = 0;
        const startTimeCounts: { [key: string]: number } = {};
        const endTimeCounts: { [key: string]: number } = {};

        shifts.forEach(shift => {
            totalDuration += calculateDuration(shift.start_time, shift.end_time);
            const rStart = roundToNearest15(shift.start_time);
            const rEnd = roundToNearest15(shift.end_time);
            startTimeCounts[rStart] = (startTimeCounts[rStart] || 0) + 1;
            endTimeCounts[rEnd] = (endTimeCounts[rEnd] || 0) + 1;
        });

        return {
            averageDuration: totalDuration / shifts.length,
            mostCommonStartTime: Object.keys(startTimeCounts).reduce((a, b) => startTimeCounts[a] > startTimeCounts[b] ? a : b),
            mostCommonEndTime: Object.keys(endTimeCounts).reduce((a, b) => endTimeCounts[a] > endTimeCounts[b] ? a : b),
        };
    }, [user?.id]);

    return { loading, yearlyStats, fetchYearlyStats, getMonthStats, getShiftStats };
}