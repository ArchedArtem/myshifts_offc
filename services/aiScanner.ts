import { supabase } from '@/services/supabase/client';

export async function scanScheduleImage(imageUri: string) {
    try {

        const response = await fetch(imageUri);
        const blob = await response.blob();

        const base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                const base64 = res.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (e) => {
                reject(e);
            };
            reader.readAsDataURL(blob);
        });

        const { data, error } = await supabase.functions.invoke('parse-shifts', {
            body: { imageBase64: base64Image },
        });

        if (error) {
            throw error;
        }

        return data;

    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА В aiScanner:', error);
        throw error;
    }
}