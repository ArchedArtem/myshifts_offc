import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Страница не найдена' }} />
            <View style={styles.container}>
                <Text style={styles.title}>404</Text>
                <Text style={styles.subtitle}>Страница не найдена</Text>
                <Link href="/" style={styles.link}>
                    <Text style={styles.linkText}>Вернуться на главную</Text>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 20,
        color: Colors.gray,
        marginBottom: 30,
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
        paddingHorizontal: 30,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    linkText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.onPrimary,
    },
});