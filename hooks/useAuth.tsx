import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/services/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    sendOTP: (email: string) => Promise<void>;
    verifyOTP: (email: string, token: string) => Promise<void>;
    signOut: () => Promise<void>;
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
            if (error) throw error;

            setSession(null);
            setUser(null);
        } catch (error: any) {
            console.error('Sign out error:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        session,
        user,
        loading,
        sendOTP,
        verifyOTP,
        signOut,
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
