import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Calendar, BarChart3, User } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { showLatestUnreadAnnouncement } from '@/services/inAppNotifications';
import { syncPushTokenForUser } from '@/services/notifications';

export default function AppLayout() {
    const { session, loading } = useAuth();
    const { theme } = useTheme();

    useEffect(() => {
        if (!session?.user?.id) return;
        showLatestUnreadAnnouncement(session.user.id);
        syncPushTokenForUser(session.user.id).catch(() => {
            // Не блокируем приложение, если сеть недоступна или push временно не синхронизирован.
        });
    }, [session?.user?.id]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!session) {
        // Пользователь не авторизован - редирект на логин
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            key={theme}
            screenOptions={{
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.gray,
                tabBarStyle: {
                    backgroundColor: Colors.white,
                    borderTopColor: Colors.border,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Календарь',
                    tabBarIcon: ({ color, size }) => (
                        <Calendar size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="statistics"
                options={{
                    title: 'Статистика',
                    tabBarIcon: ({ color, size }) => (
                        <BarChart3 size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color, size }) => (
                        <User size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="shift-edit"
                options={{
                    href: null, // Скрываем из табов
                }}
            />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen name="notifications" options={{ href: null }} />
            <Tabs.Screen name="export-data" options={{ href: null }} />
            <Tabs.Screen name="shift-templates" options={{ href: null }} />
            <Tabs.Screen name="holidays" options={{ href: null }} />
            <Tabs.Screen name="help" options={{ href: null }} />
            <Tabs.Screen name="widgets" options={{ href: null }} />
            <Tabs.Screen name="documents" options={{ href: null }} />
            <Tabs.Screen name="admin-notifications" options={{ href: null }} />
            <Tabs.Screen name="admin-push" options={{ href: null }} />
        </Tabs>
    );
}
