import React, { useEffect, useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    BackHandler,
    Platform
} from 'react-native';
import { DownloadCloud } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

interface ForceUpdateModalProps {
    visible: boolean;
    storeUrl?: string | null;
}

export default function ForceUpdateModal({ visible, storeUrl }: ForceUpdateModalProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(), [theme]);

    // Блокируем аппаратную кнопку "Назад" на Android
    useEffect(() => {
        if (!visible) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            return true;
        });

        return () => backHandler.remove();
    }, [visible]);

    const handleUpdatePress = () => {
        const targetUrl = storeUrl || (
            Platform.OS === 'android'
                ? 'https://www.rustore.ru/catalog/app/com.rasthartem.myshifts'
                : ''
        );

        Linking.openURL(targetUrl).catch(() => {});
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={() => {}}
        >
            <View style={styles.overlay}>
                <View style={styles.modalCard}>
                    <View style={styles.iconBg}>
                        <DownloadCloud size={40} color={Colors.primary} />
                    </View>

                    <Text style={styles.title}>Требуется обновление</Text>

                    <Text style={styles.description}>
                        Текущая версия приложения больше не поддерживается.
                        Пожалуйста, обновите приложение до последней версии, чтобы продолжить работу без ошибок.
                    </Text>

                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={handleUpdatePress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.updateButtonText}>Обновить сейчас</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = () => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 99999,
    },
    modalCard: {
        width: '100%',
        backgroundColor: Colors.white,
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 15,
    },
    iconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.lightPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.darkGray,
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        color: Colors.gray,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    updateButton: {
        width: '100%',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    updateButtonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
});