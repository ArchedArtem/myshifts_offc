import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Calendar, BarChart3, User } from 'lucide-react-native';
import { View, Platform, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { showLatestUnreadAnnouncement } from '@/services/inAppNotifications';
import { startShiftSyncEngine, stopShiftSyncEngine } from '@/services/offlineSync';
import { syncPushTokenForUser } from '@/services/notifications';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import ModernLoader from '@/components/ModernLoader';
import * as Haptics from '@/utils/haptics';

export default function AppLayout() {
    const { session, loading } = useAuth();
    const { theme } = useTheme();

    useEffect(() => {
        if (!session?.user?.id) return;
        showLatestUnreadAnnouncement(session.user.id);
        const runPushSync = async () => {
            try {
                await syncPushTokenForUser(session.user.id);
            } catch (e) {}
        };
        runPushSync();
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) {
            stopShiftSyncEngine();
            return;
        }
        const stop = startShiftSyncEngine(session.user.id, {
            onSynced: async () => {
                await syncNextShiftWidgetForUser(session.user.id);
            },
        });
        return stop;
    }, [session?.user?.id]);

    if (loading) {
        return <ModernLoader fullScreen={true} />;
    }

    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
            <Tabs
                key={theme}
                screenOptions={{
                    tabBarActiveTintColor: Colors.primary,
                    tabBarInactiveTintColor: Colors.gray,
                    tabBarShowLabel: true,
                    tabBarLabelStyle: styles.tabLabel,
                    tabBarStyle: {
                        backgroundColor: Colors.white,
                        borderTopWidth: 0,
                        paddingTop: 10,
                        height: Platform.OS === 'ios' ? 90 : 115,
                        paddingBottom: Platform.OS === 'ios' ? 30 : 40,
                        elevation: 25,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                    },
                    headerShown: false,
                }}
                screenListeners={{
                    state: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Календарь',
                        tabBarIcon: ({ color, focused }) => (
                            <Calendar size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="statistics"
                    options={{
                        title: 'Статистика',
                        tabBarIcon: ({ color, focused }) => (
                            <BarChart3 size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Профиль',
                        tabBarIcon: ({ color, focused }) => (
                            <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
                        ),
                    }}
                />

                {/* Скрытые экраны */}
                <Tabs.Screen name="shift-edit" options={{ href: null }} />
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
        </View>
    );
}

const styles = StyleSheet.create({
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
});