import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Calendar, BarChart3, User } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import Colors from '@/constants/Colors';
import ShiftSyncBanner from '@/components/ShiftSyncBanner';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { showLatestUnreadAnnouncement } from '@/services/inAppNotifications';
import { startShiftSyncEngine, stopShiftSyncEngine } from '@/services/offlineSync';
import { syncPushTokenForUser } from '@/services/notifications';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import ModernLoader from '@/components/ModernLoader';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!session?.user?.id) return;

    showLatestUnreadAnnouncement(session.user.id);

    const runPushSync = async () => {
      try {
        const result = await syncPushTokenForUser(session.user.id);
        if (!result.ok && result.reason) {
          console.warn('Push token sync skipped:', result.reason);
        }
      } catch {
        // Не блокируем приложение, если сеть недоступна или push временно не синхронизирован.
      }
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
      {/*<ShiftSyncBanner userId={session.user.id} />*/}

      <View style={{ flex: 1 }}>
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
              tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="statistics"
            options={{
              title: 'Статистика',
              tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Профиль',
              tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
            }}
          />
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
    </View>
  );
}
