import { supabase } from './client';

export const OTPAuthService = {
    /**
     * Гарантированная отправка OTP кода (не ссылки)
     */
    requestOTPCode: async (email: string): Promise<boolean> => {
        try {
            // Метод 1: Пробуем через токен
            const tokenResponse = await fetch(
                'https://ordhaflngrhvktewbwik.supabase.co/auth/v1/token?grant_type=otp',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhhZmxuZ3Jodmt0ZXdid2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjE0MjgsImV4cCI6MjA4NDM5NzQyOH0.CfunZTq3JNeEjpzC3x2MpybaqLznorQkzfsHweVEtyY',
                    },
                    body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        create_user: true,
                    }),
                }
            );

            if (tokenResponse.ok) {
                return true;
            }

            // Метод 2: Через verify с явным указанием
            const verifyResponse = await fetch(
                'https://ordhaflngrhvktewbwik.supabase.co/auth/v1/verify',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhhZmxuZ3Jodmt0ZXdid2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjE0MjgsImV4cCI6MjA4NDM5NzQyOH0.CfunZTq3JNeEjpzC3x2MpybaqLznorQkzfsHweVEtyY',
                    },
                    body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        type: 'signup',
                        token: 'generate', // Генерируем токен
                    }),
                }
            );

            if (verifyResponse.ok) {
                const data = await verifyResponse.json();
                console.log('OTP generated:', data);
                return true;
            }

            // Метод 3: Fallback через SDK
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim().toLowerCase(),
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: 'app://localhost', // Специальный schema для мобильных
                },
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('OTP request error:', error);
            throw error;
        }
    },

    /**
     * Проверка OTP кода
     */
    verifyOTPCode: async (email: string, token: string): Promise<any> => {
        const { data, error } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token,
            type: 'email',
        });

        if (error) throw error;
        return data;
    },
};