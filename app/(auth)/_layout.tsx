import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
    const { session, loading } = useAuth();

    if (loading) {
        return null;
    }

    if (session) {
        // Пользователь уже авторизован - редирект в приложение
        return <Redirect href="/(app)" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
        </Stack>
    );
}