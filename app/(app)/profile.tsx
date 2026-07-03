import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { loadCachedProfile, saveCachedProfile } from '@/services/profileCache';
import { useTheme } from '@/hooks/useTheme';

const ADMIN_EMAIL = 'archedartem@gmail.com';

interface ProfileHeader {
    email: string;
    full_name: string;
}

export default function ProfileScreen() {
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<ProfileHeader>({
        email: '',
        full_name: '',
    });

    const router = useRouter();
    const { user, signOut, deleteAccount } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const styles = createStyles();

    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                await saveCachedProfile(user.id, data || {});
                setProfile({
                    email: data?.email ?? user.email ?? '',
                    full_name: data?.full_name ?? '',
                });
            } catch {
                const cachedProfile = await loadCachedProfile(user.id);
                setProfile({
                    email: cachedProfile.email ?? user.email ?? '',
                    full_name: cachedProfile.full_name ?? '',
                });
            }
        };

        loadProfile();
    }, [user]);

    const handleLogout = () => {
        Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Выйти',
                style: 'destructive',
                onPress: async () => {
                    setLoading(true);
                    try {
                        await signOut();
                        router.replace('/(auth)/login');
                    } catch (error: any) {
                        Alert.alert('Ошибка', error.message);
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Удалить аккаунт',
            'Это действие удалит профиль, смены и шаблоны. Отменить нельзя. Продолжить?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await deleteAccount();
                            router.replace('/(auth)/login');
                        } catch (error: any) {
                            Alert.alert('Ошибка', error.message || 'Не удалось удалить аккаунт');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const hasName = !!profile.full_name.trim();
    const avatarChar = (hasName ? profile.full_name : profile.email)?.[0]?.toUpperCase() || 'U';
    const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{avatarChar}</Text>
                </View>

                {hasName ? (
                    <>
                        <Text style={styles.headerName}>{profile.full_name}</Text>
                        <Text style={styles.headerEmail}>{profile.email || 'Загрузка...'}</Text>
                    </>
                ) : (
                    <Text style={styles.headerName}>{profile.email || 'Загрузка...'}</Text>
                )}
            </View>

            <View style={styles.menuCard}>
                <View style={styles.themeRow}>
                    <View style={styles.themeTextWrap}>
                        <Text style={styles.menuItemText}>🌙 Темная тема</Text>
                        <Text style={styles.themeHint}>Включает темный режим приложения</Text>
                    </View>
                    <Switch
                        value={theme === 'dark'}
                        onValueChange={toggleTheme}
                        thumbColor={theme === 'dark' ? Colors.white : Colors.white}
                        trackColor={{ false: Colors.border, true: Colors.primary }}
                    />
                </View>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./settings')}>
                    <Text style={styles.menuItemText}>⚙️ Настройки</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./notifications')}>
                    <Text style={styles.menuItemText}>🔔 Уведомления</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./export-data')}>
                    <Text style={styles.menuItemText}>📤 Экспорт данных</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./shift-templates')}>
                    <Text style={styles.menuItemText}>🗂️ Шаблоны смен</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./holidays')}>
                    <Text style={styles.menuItemText}>🎉 Праздники</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./widgets')}>
                    <Text style={styles.menuItemText}>🧩 Виджеты</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./help')}>
                    <Text style={styles.menuItemText}>❓ Помощь</Text>
                </TouchableOpacity>
                {isAdmin && (
                    <>
                        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./admin-notifications')}>
                            <Text style={styles.menuItemText}>📣 Админ-панель уведомлений</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('./admin-push')}>
                            <Text style={styles.menuItemText}>🚀 Админ-панель push</Text>
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity style={styles.menuItemLast} activeOpacity={0.7} onPress={() => router.push('./documents')}>
                    <Text style={styles.menuItemText}>📚 Документы</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.actionCard}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading} activeOpacity={0.8}>
                    <Text style={styles.logoutButtonText}>{loading ? 'Выход...' : 'Выйти из аккаунта'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.supportButton} onPress={() => router.push('/support-developer')} activeOpacity={0.8}>
                    <Text style={styles.supportButtonText}>Поддержать разработчика ❤️</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.deleteAccountLink} onPress={handleDeleteAccount} disabled={loading}>
                <Text style={styles.deleteAccountText}>{loading ? 'Удаление...' : 'Удалить аккаунт'}</Text>
            </TouchableOpacity>

            {/* Метка версии приложения */}
            <Text style={styles.versionText}>Версия приложения 2.4.0</Text>
        </ScrollView>
    );
}

const createStyles = () => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 70 : 50,
        paddingBottom: 24,
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.lightPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '800',
        color: Colors.primary,
    },
    headerName: {
        fontSize: 24,
        color: Colors.darkGray,
        fontWeight: '800',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    headerEmail: {
        fontSize: 15,
        color: Colors.gray,
        fontWeight: '500',
        marginTop: 6,
    },

    menuCard: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        borderRadius: 20,
        paddingVertical: 8,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 20,
    },
    themeRow: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    themeTextWrap: {
        flex: 1,
    },
    themeHint: {
        fontSize: 12,
        color: Colors.gray,
        marginTop: 4,
    },
    menuItem: {
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuItemLast: {
        paddingVertical: 18,
        paddingHorizontal: 20,
    },
    menuItemText: {
        fontSize: 16,
        color: Colors.darkGray,
        fontWeight: '600',
    },

    actionCard: {
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        borderRadius: 20,
        padding: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 24,
    },
    logoutButton: {
        backgroundColor: Colors.lightGray,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.darkGray,
    },
    supportButton: {
        marginTop: 16,
        borderWidth: 1.5,
        borderColor: Colors.border,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: Colors.white,
    },
    supportButtonText: {
        fontSize: 15,
        color: Colors.primary,
        fontWeight: '700',
    },

    deleteAccountLink: {
        alignSelf: 'center',
        paddingTop: 16,
        paddingBottom: 4,
        paddingHorizontal: 20,
    },
    deleteAccountText: {
        fontSize: 14,
        color: Colors.gray,
        fontWeight: '600',
    },
    versionText: {
        fontSize: 12,
        color: Colors.gray,
        fontWeight: '500',
        textAlign: 'center',
        opacity: 0.6,
        marginTop: 10,
        paddingBottom: 3,
    },
});