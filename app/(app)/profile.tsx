import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

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
            const { data } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', user.id)
                .single();

            setProfile({
                email: data?.email ?? user.email ?? '',
                full_name: data?.full_name ?? '',
            });
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

    const openDocs = async () => {
        const url = 'https://archedartem.github.io/my-shifts-docs/';
        const supported = await Linking.canOpenURL(url);

        if (!supported) {
            Alert.alert('Ошибка', 'Не удалось открыть документацию');
            return;
        }

        await Linking.openURL(url);
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

    return (
        <ScrollView style={styles.screen}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{avatarChar}</Text>
                </View>

                {hasName ? (
                    <>
                        <Text style={styles.headerName}>{profile.full_name}</Text>
                        <Text style={styles.headerEmailSub}>{profile.email || 'Загрузка...'}</Text>
                    </>
                ) : (
                    <Text style={styles.headerEmail}>{profile.email || 'Загрузка...'}</Text>
                )}
            </View>

            <View style={styles.menuCard}>
                <View style={styles.themeRow}>
                    <View>
                        <Text style={styles.menuItemText}>🌙 Темная тема</Text>
                        <Text style={styles.themeHint}>Включает темный режим приложения</Text>
                    </View>
                    <Switch
                        value={theme === 'dark'}
                        onValueChange={toggleTheme}
                        thumbColor={theme === 'dark' ? Colors.primary : '#f4f3f4'}
                        trackColor={{ false: '#d1d5db', true: Colors.lightPrimary }}
                    />
                </View>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./settings')}>
                    <Text style={styles.menuItemText}>⚙️ Настройки</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./notifications')}>
                    <Text style={styles.menuItemText}>🔔 Уведомления</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./export-data')}>
                    <Text style={styles.menuItemText}>📤 Экспорт данных</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./shift-templates')}>
                    <Text style={styles.menuItemText}>🗂️ Шаблоны смен</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./holidays')}>
                    <Text style={styles.menuItemText}>🎉 Праздники</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./widgets')}>
                    <Text style={styles.menuItemText}>🧩 Виджеты</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./help')}>
                    <Text style={styles.menuItemText}>❓ Помощь</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItemLast} onPress={() => { void openDocs(); }}>
                    <Text style={styles.menuItemText}>📚 Документация</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <Text style={styles.dangerTitle}>Опасная зона</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>
                    <Text style={styles.logoutButtonText}>{loading ? 'Выход...' : 'Выйти из аккаунта'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={loading}>
                    <Text style={styles.deleteButtonText}>{loading ? 'Удаление...' : 'Удалить аккаунт'}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const createStyles = () => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        backgroundColor: Colors.primary,
        padding: 30,
        alignItems: 'center',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    headerName: {
        fontSize: 22,
        color: Colors.onPrimary,
        fontWeight: '700',
    },
    headerEmail: {
        fontSize: 18,
        color: Colors.onPrimary,
        fontWeight: '500',
    },
    headerEmailSub: {
        fontSize: 14,
        color: Colors.onPrimary,
        opacity: 0.9,
        marginTop: 4,
    },
    menuCard: {
        backgroundColor: Colors.white,
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 12,
    },
    menuItem: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    themeRow: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    themeHint: {
        fontSize: 12,
        color: Colors.gray,
        marginTop: 4,
    },
    menuItemLast: {
        padding: 20,
    },
    menuItemText: {
        fontSize: 16,
        color: Colors.darkGray,
    },
    card: {
        backgroundColor: Colors.white,
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 20,
        marginBottom: 30,
    },
    dangerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.error,
        marginBottom: 20,
    },
    logoutButton: {
        backgroundColor: Colors.lightGray,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.darkGray,
    },
    deleteButton: {
        marginTop: 12,
        backgroundColor: Colors.lightError,
        borderWidth: 1,
        borderColor: Colors.error,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.error,
    },
});
