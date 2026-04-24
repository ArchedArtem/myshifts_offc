import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/services/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { clearNextShiftWidgetState, syncNextShiftWidgetForUser } from '@/services/androidWidget';
import { clearCachedProfile, saveCachedProfile } from '@/services/profileCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    await saveCachedProfile(user.id, {
        email,
        updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) console.error('Ensure profile error:', error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initAuthFast = async () => {
            try {
                const keys = await AsyncStorage.getAllKeys();
                const authKey = keys.find(k => k.includes('supabase') && k.includes('auth-token'));
                if (authKey) {
                    const rawData = await AsyncStorage.getItem(authKey);
                    if (rawData) {
                        const sessionData = JSON.parse(rawData);
                        if (sessionData?.user) {
                            setSession(sessionData);
                            setUser(sessionData.user);
                            setLoading(false);
                        }
                    }
                }
            } catch (e) { }

            supabase.auth.getSession().then(({ data: { session } }) => {
                if (!isMounted) return;
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                if (session?.user) {
                    ensureProfile(session.user).catch(() => {});
                }
            });
        };

        initAuthFast();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                if (session?.user) ensureProfile(session.user).catch(() => {});
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (user?.id) {
            syncNextShiftWidgetForUser(user.id);
            return;
        }
        clearNextShiftWidgetState();
    }, [user?.id]);

    const sendOTP = async (email: string): Promise<void> => {
        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { shouldCreateUser: true },
        });
        if (error) throw new Error(error.message || 'Не удалось отправить код');
    };

    const verifyOTP = async (email: string, token: string): Promise<void> => {
        const { data, error } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(), token, type: 'email',
        });
        if (error) throw new Error(error.message || 'Неверный код или время истекло');
        if (data.user) await ensureProfile(data.user);
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error && !error.message.toLowerCase().includes('auth session missing')) throw error;
            setSession(null);
            setUser(null);
            await clearCachedProfile(user?.id);
        } catch (error: any) {
            throw error;
        }
    };

    const deleteAccount = async () => {
        if (!user) throw new Error('Пользователь не авторизован');
        const tablesToClean = ['shifts', 'shift_templates'] as const;
        for (const table of tablesToClean) {
            const { error } = await supabase.from(table).delete().eq('user_id', user.id);
            if (error) throw new Error(error.message);
        }
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', user.id);
        if (profileError) throw new Error(profileError.message);

        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
            await fetch(`${supabaseUrl}/auth/v1/user`, {
                method: 'DELETE',
                headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${data.session.access_token}` },
            });
        }
        await signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, sendOTP, verifyOTP, signOut, deleteAccount }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}