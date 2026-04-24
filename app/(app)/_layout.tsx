import React, { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Calendar, BarChart3, User, WifiOff } from 'lucide-react-native';
import { View, Platform, StyleSheet, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { showLatestUnreadAnnouncement } from '@/services/inAppNotifications';
import { startShiftSyncEngine, stopShiftSyncEngine } from '@/services/offlineSync';
import { syncPushTokenForUser } from '@/services/notifications';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import ModernLoader from '@/components/ModernLoader';
import * as Haptics from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

export default function AppLayout() {
    const { session, loading } = useAuth();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const offline = state.isConnected === false || (state.isConnected === true && state.isInternetReachable === false);
            setIsOffline(offline);
        });
        return () => unsubscribe();
    }, []);

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
                    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                    tabBarStyle: {
                        backgroundColor: Colors.white,
                        borderTopWidth: 0,
                        height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
                        paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
                        paddingTop: 3,
                        elevation: 25,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                    },
                    headerShown: false,
                }}
                screenListeners={{
                    state: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                }}
            >
                <Tabs.Screen name="index" options={{ title: 'Календарь', tabBarIcon: ({ color, focused }) => <Calendar size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> }} />
                <Tabs.Screen name="statistics" options={{ title: 'Статистика', tabBarIcon: ({ color, focused }) => <BarChart3 size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> }} />
                <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color, focused }) => <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} /> }} />

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

            {isOffline && (
                <View style={{
                    position: 'absolute',
                    top: insets.top + 10,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    elevation: 100,
                }}>
                    <View style={{
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        shadowColor: '#000',
                        shadowOpacity: 0.2,
                        shadowRadius: 5,
                        shadowOffset: { width: 0, height: 2 }
                    }}>
                        <WifiOff size={14} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Нет сети</Text>
                    </View>
                </View>
            )}
        </View>
    );
}