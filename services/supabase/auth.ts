import { supabase } from './client';

export const AuthService = {
    /**
     * Отправка OTP КОДА (не ссылки) на email для входа
     * Используем прямой API вызов для гарантированной отправки кода
     */
    sendOTP: async (email: string): Promise<void> => {
        try {
            const response = await fetch(
                'https://ordhaflngrhvktewbwik.supabase.co/auth/v1/otp',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhhZmxuZ3Jodmt0ZXdid2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjE0MjgsImV4cCI6MjA4NDM5NzQyOH0.CfunZTq3JNeEjpzC3x2MpybaqLznorQkzfsHweVEtyY',
                    },
                    body: JSON.stringify({
                        email,
                        type: 'email',
                        data: {
                            should_create_user: true,
                            // Дополнительные параметры для мобильного приложения
                            app: 'ShiftTracker',
                            platform: 'react-native'
                        }
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('OTP API Error:', errorData);

                // Попробуем fallback метод через SDK
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: true,
                        // Явно отключаем редирект для отправки кода
                        emailRedirectTo: undefined,
                    },
                });

                if (error) {
                    throw new Error(`Ошибка отправки OTP: ${error.message}`);
                }
            }

            return;
        } catch (error: any) {
            console.error('OTP request error:', error);
            throw new Error(`Ошибка отправки OTP: ${error.message || 'Неизвестная ошибка'}`);
        }
    },

    /**
     * Проверка OTP кода
     */
    verifyOTP: async (email: string, token: string): Promise<any> => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'email',
            });

            if (error) {
                throw new Error(`Ошибка проверки OTP: ${error.message}`);
            }

            return data;
        } catch (error: any) {
            console.error('Verify OTP error:', error);
            throw error;
        }
    },

    /**
     * Выход из системы
     */
    signOut: async (): Promise<void> => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw new Error(`Ошибка выхода: ${error.message}`);
        }
    },

    /**
     * Получение текущей сессии
     */
    getSession: async (): Promise<any> => {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            throw new Error(`Ошибка получения сессии: ${error.message}`);
        }

        return session;
    },

    /**
     * Получение текущего пользователя
     */
    getCurrentUser: async (): Promise<any> => {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            throw new Error(`Ошибка получения пользователя: ${error.message}`);
        }

        return user;
    },

    /**
     * Обновление профиля пользователя
     */
    updateProfile: async (updates: {
        full_name?: string;
        avatar_url?: string;
    }): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Пользователь не авторизован');
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) {
            throw new Error(`Ошибка обновления профиля: ${error.message}`);
        }
    },

    /**
     * Сброс пароля
     */
    resetPassword: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'shifttracker://reset-password',
        });

        if (error) {
            throw new Error(`Ошибка сброса пароля: ${error.message}`);
        }
    },

    /**
     * Подписка на изменения состояния аутентификации
     */
    onAuthStateChange: (callback: (event: any, session: any) => void) => {
        return supabase.auth.onAuthStateChange(callback);
    },

    /**
     * Проверка, авторизован ли пользователь
     */
    isAuthenticated: async (): Promise<boolean> => {
        try {
            const session = await AuthService.getSession();
            return !!session;
        } catch {
            return false;
        }
    },

    /**
     * Получение токена доступа
     */
    getAccessToken: async (): Promise<string | null> => {
        try {
            const session = await AuthService.getSession();
            return session?.access_token || null;
        } catch {
            return null;
        }
    },
};