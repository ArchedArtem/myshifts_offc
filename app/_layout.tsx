import { useEffect, useState } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { AuthProvider } from '@/hooks/useAuth';
import { ActivityIndicator, Platform, StatusBar as NativeStatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { initializeNotifications } from '@/services/notifications';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { registerNextShiftWidgetTask } from '@/services/androidWidget';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ModernLoader from '@/components/ModernLoader';

SplashScreen.preventAutoHideAsync();

function LayoutInitializer() {
    const [appIsReady, setAppIsReady] = useState(false);
    const { initialized, theme } = useTheme();

    useEffect(() => {
        registerNextShiftWidgetTask();

        if (!initialized) return;

        initializeNotifications();

        const timer = setTimeout(() => {
            setAppIsReady(true);
            SplashScreen.hideAsync();
        }, 300);

        return () => clearTimeout(timer);
    }, [initialized]);

    if (!appIsReady || !initialized) {
        return <ModernLoader fullScreen={true} />;
    }

    return <Slot key={theme} />;
}

function ThemedRootContainer() {
    const { theme } = useTheme();

    useEffect(() => {
        SystemUI.setBackgroundColorAsync(Colors.background).catch(() => {});

        if (Platform.OS === 'android') {
            NativeStatusBar.setTranslucent(false);
            NativeStatusBar.setBackgroundColor(Colors.background, true);
            NativeStatusBar.setBarStyle(theme === 'dark' ? 'light-content' : 'dark-content', true);
        }
    }, [theme]);

    return (
        <>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={Colors.background} translucent={false} />
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
                <AuthProvider>
                    <LayoutInitializer />
                </AuthProvider>
            </SafeAreaView>
        </>
    );
}

function ThemedProviders() {
    return (
        <SafeAreaProvider style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={{ flex: 1, backgroundColor: Colors.background }}>
                <ThemedRootContainer />
            </View>
        </SafeAreaProvider>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <ThemedProviders />
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}