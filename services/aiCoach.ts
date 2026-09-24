import { supabase } from '@/services/supabase/client';

export type AiInsightItem = {
    id: string;
    type: 'growth' | 'warning' | 'tip';
    title: string;
    description: string;
    icon: string;
    iconColor: string;
};

interface GetCoachInsightsParams {
    userId: string;
    periodType: string;
    periodIdentifier: string;
    currentShiftsCount: number;
    currentEarnings: number;
    statsData: any;
    isVkusnoWorker: boolean;
}

export const getAiCoachInsights = async ({
                                             userId,
                                             periodType,
                                             periodIdentifier,
                                             currentShiftsCount,
                                             currentEarnings,
                                             statsData,
                                             isVkusnoWorker
                                         }: GetCoachInsightsParams): Promise<AiInsightItem[]> => {
    try {
        // 1. Проверяем наличие валидного кэша в базе данных
        const { data: cachedRecord, error: cacheError } = await supabase
            .from('ai_statistics_insights')
            .select('insights, shifts_count, total_earnings')
            .eq('user_id', userId)
            .eq('period_type', periodType)
            .eq('period_identifier', periodIdentifier)
            .maybeSingle();

        // Если кэш есть и данные смен/заработка не менялись с прошлого раза — отдаем его моментально
        if (
            cachedRecord &&
            cachedRecord.shifts_count === currentShiftsCount &&
            Number(cachedRecord.total_earnings) === currentEarnings
        ) {
            return cachedRecord.insights as AiInsightItem[];
        }

        // 2. Если кэша нет или данные изменились — вызываем Edge Function
        const { data, error } = await supabase.functions.invoke('ai-coach', {
            body: {
                stats: statsData,
                periodType,
                periodIdentifier,
                isVkusnoWorker
            }
        });

        if (error || !data?.insights) throw error || new Error("Ошибка парсинга ответа ИИ");

        return data.insights as AiInsightItem[];
    } catch (err) {
        console.error("Не удалось подгрузить ИИ инсайты, включаю фолбек:", err);

        // Мягкий фолбек на случай падения сети или лимитов API, чтобы экран не пустовал
        return [
            {
                id: 'fallback_1',
                type: 'tip',
                title: 'Статистика обновлена',
                description: `Вы успешно отработали ${currentShiftsCount} смен за выбранный период. Продолжайте в том же духе для накопления точных трендов графика.`,
                icon: 'sparkles-outline',
                iconColor: '#4F46E5'
            }
        ];
    }
};