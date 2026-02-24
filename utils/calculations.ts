import { format, parse, differenceInMinutes } from 'date-fns';

/**
 * Расчет заработка за смену
 */
export const calculateEarnings = (
    startTime: string,
    endTime: string,
    hourlyRate: number,
    extraPayment: number = 0,
    breakMinutes: number = 0
): number => {
    const duration = calculateDuration(startTime, endTime, breakMinutes);
    const baseEarnings = duration * hourlyRate;
    return baseEarnings + extraPayment;
};

/**
 * Расчет продолжительности смены в часах
 */
export const calculateDuration = (
    startTime: string,
    endTime: string,
    breakMinutes: number = 0
): number => {
    try {
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());

        // Если время окончания раньше времени начала (ночная смена)
        if (end < start) {
            const endOfDay = parse('23:59', 'HH:mm', new Date());
            const startOfDay = parse('00:00', 'HH:mm', new Date());

            const durationBeforeMidnight = differenceInMinutes(endOfDay, start) + 1; // +1 минута до 00:00
            const durationAfterMidnight = differenceInMinutes(end, startOfDay);

            const totalHours = (durationBeforeMidnight + durationAfterMidnight) / 60;
            const breakHours = Math.max(0, breakMinutes) / 60;
            return Math.max(0, totalHours - breakHours);
        }

        const durationInMinutes = differenceInMinutes(end, start);
        const totalHours = durationInMinutes / 60;
        const breakHours = Math.max(0, breakMinutes) / 60;
        return Math.max(0, totalHours - breakHours);
    } catch (error) {
        console.error('Error calculating duration:', error);
        return 0;
    }
};

/**
 * Форматирование продолжительности в читаемый вид
 */
export const formatDuration = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `${m}м`;
    if (m === 0) return `${h}ч`;
    return `${h}ч ${m}м`;
};

/**
 * Расчет почасовой ставки из общего заработка
 */
export const calculateHourlyRate = (
    earnings: number,
    hours: number
): number => {
    return hours > 0 ? earnings / hours : 0;
};

/**
 * Расчет налога (пример для РФ)
 */
export const calculateTax = (
    earnings: number,
    taxRate: number = 13 // 13% НДФЛ
): number => {
    return (earnings * taxRate) / 100;
};

/**
 * Расчет чистого дохода (после вычета налога)
 */
export const calculateNetEarnings = (
    earnings: number,
    taxRate: number = 13
): number => {
    const tax = calculateTax(earnings, taxRate);
    return earnings - tax;
};


export const NDFL_RATE = 13;

export const applyNdfl = (earnings: number, includeNdfl: boolean): number => {
    if (!includeNdfl) return earnings;
    return calculateNetEarnings(earnings, NDFL_RATE);
};

/**
 * Расчет сверхурочных (пример: 1.5x за первые 2 часа, 2x далее)
 */
export const calculateOvertime = (
    regularHours: number,
    overtimeHours: number,
    hourlyRate: number,
    overtimeRate1: number = 1.5, // Первые 2 часа
    overtimeRate2: number = 2.0   // Последующие часы
): number => {
    const regularPay = regularHours * hourlyRate;

    if (overtimeHours <= 2) {
        return regularPay + (overtimeHours * hourlyRate * overtimeRate1);
    } else {
        const firstTwoHours = 2 * hourlyRate * overtimeRate1;
        const remainingHours = (overtimeHours - 2) * hourlyRate * overtimeRate2;
        return regularPay + firstTwoHours + remainingHours;
    }
};

/**
 * Расчет еженедельного заработка
 */
export const calculateWeeklyEarnings = (
    shifts: Array<{
        startTime: string;
        endTime: string;
        hourlyRate: number;
        extraPayment?: number;
        breakMinutes?: number;
    }>
): number => {
    return shifts.reduce((total, shift) => {
        const earnings = calculateEarnings(
            shift.startTime,
            shift.endTime,
            shift.hourlyRate,
            shift.extraPayment || 0,
            shift.breakMinutes || 0
        );
        return total + earnings;
    }, 0);
};

/**
 * Расчет среднего заработка в час
 */
export const calculateAverageHourlyRate = (
    shifts: Array<{
        earnings: number;
        hours: number;
    }>
): number => {
    const totalEarnings = shifts.reduce((sum, shift) => sum + shift.earnings, 0);
    const totalHours = shifts.reduce((sum, shift) => sum + shift.hours, 0);

    return totalHours > 0 ? totalEarnings / totalHours : 0;
};

/**
 * Проверка на ночную смену (с 22:00 до 6:00)
 */
export const isNightShift = (
    startTime: string,
    endTime: string
): boolean => {
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);

    // Если смена начинается или заканчивается в ночное время
    return startHour >= 22 || startHour < 6 || endHour >= 22 || endHour < 6;
};

/**
 * Расчет ночных часов (для доплат)
 */
export const calculateNightHours = (
    startTime: string,
    endTime: string
): number => {
    const start = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());

    let nightHours = 0;
    let current = start;

    // Если время окончания раньше времени начала (ночная смена через полночь)
    if (end < start) {
        const endOfDay = parse('23:59', 'HH:mm', new Date());
        const startOfDay = parse('00:00', 'HH:mm', new Date());

        // Часы до полуночи
        let temp = start;
        while (temp <= endOfDay) {
            const hour = temp.getHours();
            if (hour >= 22 || hour < 6) nightHours += 1/60; // +1 минута
            temp = new Date(temp.getTime() + 60000); // +1 минута
        }

        // Часы после полуночи
        temp = startOfDay;
        while (temp <= end) {
            const hour = temp.getHours();
            if (hour >= 22 || hour < 6) nightHours += 1/60; // +1 минута
            temp = new Date(temp.getTime() + 60000); // +1 минута
        }
    } else {
        // Обычная смена
        let temp = start;
        while (temp <= end) {
            const hour = temp.getHours();
            if (hour >= 22 || hour < 6) nightHours += 1/60; // +1 минута
            temp = new Date(temp.getTime() + 60000); // +1 минута
        }
    }

    return nightHours;
};

/**
 * Расчет доплаты за ночные часы
 */
export const calculateNightBonus = (
    startTime: string,
    endTime: string,
    hourlyRate: number,
    nightBonusRate: number = 1.35 // 35% доплата за ночные
): number => {
    const nightHours = calculateNightHours(startTime, endTime);
    return nightHours * hourlyRate * (nightBonusRate - 1);
};