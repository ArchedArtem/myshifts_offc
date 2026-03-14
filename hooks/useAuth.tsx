import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/services/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { clearNextShiftWidgetState, syncNextShiftWidgetForUser } from '@/services/androidWidget';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    sendOTP: (email: string) => Promise<void>;
    verifyOTP: (email: string, token: string) => Promise<void>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureProfile(user: User): Promise<void> {
    const email = user.email?.trim().toLowerCase();
    if (!email) return;

    const { error } = await supabase
        .from('profiles')
        .upsert(
            {
                id: user.id,
                email,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'id',
            }
        );

    if (error) {
        console.error('Ensure profile error:', error);
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                await ensureProfile(session.user);
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                console.log('Auth state changed:', _event);
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    ensureProfile(session.user);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);


    useEffect(() => {
        if (user?.id) {
            syncNextShiftWidgetForUser(user.id);
            return;
        }

        clearNextShiftWidgetState();
    }, [user?.id]);
    const sendOTP = async (email: string): Promise<void> => {
        const normalizedEmail = email.trim().toLowerCase();

        const { error } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
                shouldCreateUser: true,
            },
        });

        if (error) {
            throw new Error(error.message || 'Не удалось отправить код');
        }
    };

    const verifyOTP = async (email: string, token: string): Promise<void> => {
        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token,
            type: 'email',
        });

        if (error) {
            throw new Error(error.message || 'Неверный код или время истекло');
        }

        if (data.user) {
            await ensureProfile(data.user);
        }
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            const errorMessage = (error as any)?.message || '';
            const isMissingSession = errorMessage.toLowerCase().includes('auth session missing');

            // В Expo Go/после долгого простоя локальная сессия может уже отсутствовать.
            // Это состояние для выхода считаем успешным, просто очищаем локальный state.
            if (error && !isMissingSession) throw error;

            setSession(null);
            setUser(null);
        } catch (error: any) {
            console.error('Sign out error:', error);
            throw error;
        }
    };

    const deleteAccount = async () => {
        if (!user) {
            throw new Error('Пользователь не авторизован');
        }

        const tablesToClean = ['shifts', 'shift_templates'] as const;

        for (const table of tablesToClean) {
            const { error } = await supabase.from(table).delete().eq('user_id', user.id);
            if (error) {
                throw new Error(error.message || `Не удалось очистить ${table}`);
            }
        }

        const { error: profileError } = await supabase.from('profiles').delete().eq('id', user.id);
        if (profileError) {
            throw new Error(profileError.message || 'Не удалось удалить профиль');
        }

        // Попытка удалить пользователя из Supabase Auth.
        // В некоторых конфигурациях этот endpoint закрыт для клиентского anon key.
        // Тогда считаем удаление успешным после очистки данных приложения и выхода из аккаунта.
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (accessToken) {
            const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                method: 'DELETE',
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn('Auth user delete failed, continue with local cleanup:', errorText);
            }
        }

        await signOut();
    };

    const value: AuthContextType = {
        session,
        user,
        loading,
        sendOTP,
        verifyOTP,
        signOut,
        deleteAccount,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
