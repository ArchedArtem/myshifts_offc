import {
    format as dateFnsFormat,
    parse,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval,
    isSameDay,
    isSameWeek,
    isSameMonth,
    isSameYear,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
    addMonths,
    subMonths,
    addYears,
    subYears,
    isWeekend,
    isBefore,
    isAfter,
    isValid,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Форматирование даты для отображения
 */
export const formatDate = (
    date: Date | string | number,
    formatStr: string = 'dd.MM.yyyy'
): string => {
    try {
        const dateObj = typeof date === 'string' || typeof date === 'number'
            ? new Date(date)
            : date;

        if (!isValid(dateObj)) {
            return 'Неверная дата';
        }

        return dateFnsFormat(dateObj, formatStr, { locale: ru });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Ошибка даты';
    }
};

/**
 * Форматирование времени
 */
export const formatTime = (
    time: string | Date,
    formatStr: string = 'HH:mm'
): string => {
    try {
        let date: Date;

        if (typeof time === 'string') {
            // Если передана строка времени "HH:mm"
            if (time.includes(':')) {
                const [hours, minutes] = time.split(':').map(Number);
                date = new Date();
                date.setHours(hours, minutes, 0, 0);
            } else {
                // Если это timestamp или ISO строка
                date = new Date(time);
            }
        } else {
            date = time;
        }

        if (!isValid(date)) {
            return 'Неверное время';
        }

        return dateFnsFormat(date, formatStr);
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'Ошибка времени';
    }
};

/**
 * Парсинг времени из строки
 */
export const parseTime = (timeString: string): Date => {
    try {
        return parse(timeString, 'HH:mm', new Date());
    } catch (error) {
        console.error('Error parsing time:', error);
        return new Date();
    }
};

/**
 * Получение начала и конца недели
 */
export const getWeekRange = (date: Date = new Date()) => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Понедельник
    const end = endOfWeek(date, { weekStartsOn: 1 });

    return {
        start: dateFnsFormat(start, 'yyyy-MM-dd'),
        end: dateFnsFormat(end, 'yyyy-MM-dd'),
        startDate: start,
        endDate: end,
    };
};

/**
 * Получение начала и конца месяца
 */
export const getMonthRange = (date: Date = new Date()) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    return {
        start: dateFnsFormat(start, 'yyyy-MM-dd'),
        end: dateFnsFormat(end, 'yyyy-MM-dd'),
        startDate: start,
        endDate: end,
    };
};

/**
 * Получение начала и конца года
 */
export const getYearRange = (date: Date = new Date()) => {
    const start = startOfYear(date);
    const end = endOfYear(date);

    return {
        start: dateFnsFormat(start, 'yyyy-MM-dd'),
        end: dateFnsFormat(end, 'yyyy-MM-dd'),
        startDate: start,
        endDate: end,
    };
};

/**
 * Получение всех дней в интервале
 */
export const getDaysInRange = (startDate: Date, endDate: Date): string[] => {
    try {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        return days.map(day => dateFnsFormat(day, 'yyyy-MM-dd'));
    } catch (error) {
        console.error('Error getting days in range:', error);
        return [];
    }
};

/**
 * Получение всех недель в интервале
 */
export const getWeeksInRange = (startDate: Date, endDate: Date) => {
    try {
        const weeks = eachWeekOfInterval(
            { start: startDate, end: endDate },
            { weekStartsOn: 1 }
        );

        return weeks.map(week => ({
            weekStart: dateFnsFormat(startOfWeek(week, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            weekEnd: dateFnsFormat(endOfWeek(week, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            weekNumber: dateFnsFormat(week, 'w'),
        }));
    } catch (error) {
        console.error('Error getting weeks in range:', error);
        return [];
    }
};

/**
 * Получение всех месяцев в интервале
 */
export const getMonthsInRange = (startDate: Date, endDate: Date) => {
    try {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });

        return months.map(month => ({
            monthStart: dateFnsFormat(startOfMonth(month), 'yyyy-MM-dd'),
            monthEnd: dateFnsFormat(endOfMonth(month), 'yyyy-MM-dd'),
            monthName: dateFnsFormat(month, 'MMMM yyyy', { locale: ru }),
            monthShort: dateFnsFormat(month, 'MMM yyyy', { locale: ru }),
        }));
    } catch (error) {
        console.error('Error getting months in range:', error);
        return [];
    }
};

/**
 * Проверка, является ли дата сегодняшним днем
 */
export const isToday = (date: Date | string): boolean => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return isSameDay(dateObj, new Date());
    } catch {
        return false;
    }
};

/**
 * Проверка, является ли дата выходным
 */
export const isDayOff = (date: Date | string): boolean => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return isWeekend(dateObj);
    } catch {
        return false;
    }
};

/**
 * Получение названия дня недели
 */
export const getDayName = (
    date: Date | string,
    formatType: 'full' | 'short' = 'full'
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (!isValid(dateObj)) {
            return '???';
        }

        const formatStr = formatType === 'full' ? 'EEEE' : 'EEE';
        return dateFnsFormat(dateObj, formatStr, { locale: ru });
    } catch (error) {
        console.error('Error getting day name:', error);
        return '???';
    }
};

/**
 * Получение названия месяца
 */
export const getMonthName = (
    date: Date | string,
    formatType: 'full' | 'short' = 'full'
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (!isValid(dateObj)) {
            return '???';
        }

        const formatStr = formatType === 'full' ? 'MMMM' : 'MMM';
        return dateFnsFormat(dateObj, formatStr, { locale: ru });
    } catch (error) {
        console.error('Error getting month name:', error);
        return '???';
    }
};

/**
 * Добавление дней к дате
 */
export const addDaysToDate = (
    date: Date | string,
    days: number
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const newDate = addDays(dateObj, days);
        return dateFnsFormat(newDate, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding days:', error);
        return dateFnsFormat(new Date(), 'yyyy-MM-dd');
    }
};

/**
 * Вычитание дней из даты
 */
export const subtractDaysFromDate = (
    date: Date | string,
    days: number
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const newDate = subDays(dateObj, days);
        return dateFnsFormat(newDate, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error subtracting days:', error);
        return dateFnsFormat(new Date(), 'yyyy-MM-dd');
    }
};

/**
 * Получение разницы между датами в днях
 */
export const getDaysDifference = (
    date1: Date | string,
    date2: Date | string
): number => {
    try {
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

        return Math.abs(differenceInDays(d1, d2));
    } catch (error) {
        console.error('Error calculating days difference:', error);
        return 0;
    }
};

/**
 * Генерация дат для календаря
 */
export const generateCalendarDates = (
    year: number,
    month: number
): Array<{
    date: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
}> => {
    try {
        const currentDate = new Date(year, month - 1, 1);
        const startOfMonthDate = startOfMonth(currentDate);
        const endOfMonthDate = endOfMonth(currentDate);

        // Начинаем с понедельника перед началом месяца
        const startDate = startOfWeek(startOfMonthDate, { weekStartsOn: 1 });
        // Заканчиваем воскресеньем после конца месяца
        const endDate = endOfWeek(endOfMonthDate, { weekStartsOn: 1 });

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        return days.map(day => ({
            date: dateFnsFormat(day, 'yyyy-MM-dd'),
            day: day.getDate(),
            isCurrentMonth: isSameMonth(day, currentDate),
            isToday: isSameDay(day, new Date()),
            isWeekend: isWeekend(day),
        }));
    } catch (error) {
        console.error('Error generating calendar dates:', error);
        return [];
    }
};

/**
 * Валидация даты
 */
export const isValidDate = (dateString: string): boolean => {
    try {
        const date = new Date(dateString);
        return isValid(date) && dateString === dateFnsFormat(date, 'yyyy-MM-dd');
    } catch {
        return false;
    }
};

/**
 * Валидация времени
 */
export const isValidTime = (timeString: string): boolean => {
    try {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(timeString);
    } catch {
        return false;
    }
};

/**
 * Получение текущей даты в формате YYYY-MM-DD
 */
export const getCurrentDate = (): string => {
    return dateFnsFormat(new Date(), 'yyyy-MM-dd');
};

/**
 * Получение текущего времени в формате HH:mm
 */
export const getCurrentTime = (): string => {
    return dateFnsFormat(new Date(), 'HH:mm');
};

/**
 * Преобразование строки даты в объект Date
 */
export const stringToDate = (dateString: string): Date => {
    return new Date(dateString);
};

/**
 * Проверка, находится ли дата в будущем
 */
export const isFutureDate = (date: Date | string): boolean => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return isAfter(dateObj, new Date());
    } catch {
        return false;
    }
};

/**
 * Проверка, находится ли дата в прошлом
 */
export const isPastDate = (date: Date | string): boolean => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return isBefore(dateObj, new Date());
    } catch {
        return false;
    }
};

/**
 * Получение разницы во времени между двумя датами в часах
 */
export const getHoursDifference = (
    date1: Date | string,
    date2: Date | string
): number => {
    try {
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

        return Math.abs(differenceInHours(d1, d2));
    } catch (error) {
        console.error('Error calculating hours difference:', error);
        return 0;
    }
};

/**
 * Получение разницы во времени между двумя датами в минутах
 */
export const getMinutesDifference = (
    date1: Date | string,
    date2: Date | string
): number => {
    try {
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

        return Math.abs(differenceInMinutes(d1, d2));
    } catch (error) {
        console.error('Error calculating minutes difference:', error);
        return 0;
    }
};

/**
 * Добавление месяцев к дате
 */
export const addMonthsToDate = (
    date: Date | string,
    months: number
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const newDate = addMonths(dateObj, months);
        return dateFnsFormat(newDate, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding months:', error);
        return dateFnsFormat(new Date(), 'yyyy-MM-dd');
    }
};

/**
 * Добавление лет к дате
 */
export const addYearsToDate = (
    date: Date | string,
    years: number
): string => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const newDate = addYears(dateObj, years);
        return dateFnsFormat(newDate, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding years:', error);
        return dateFnsFormat(new Date(), 'yyyy-MM-dd');
    }
};