import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/haptics';

export default function DocumentsScreen() {
    useTheme();
    const router = useRouter();
    const styles = createStyles();

    const handlePress = (doc: 'privacy' | 'terms') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/legal?doc=${doc}`);
    };

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Документы</Text>
                <Text style={styles.subtitle}>Юридическая информация и правила использования сервиса.</Text>
            </View>

            <TouchableOpacity
                style={styles.card}
                onPress={() => handlePress('privacy')}
                activeOpacity={0.7}
            >
                <View style={styles.cardIconWrap}>
                    <Ionicons name="lock-closed-outline" size={24} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Политика конфиденциальности</Text>
                    <Text style={styles.cardDescription}>Как мы обрабатываем и защищаем ваши данные</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.border} />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.card}
                onPress={() => handlePress('terms')}
                activeOpacity={0.7}
            >
                <View style={styles.cardIconWrap}>
                    <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Пользовательское соглашение</Text>
                    <Text style={styles.cardDescription}>Правила использования приложения «Мои смены»</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.border} />
            </TouchableOpacity>
        </ScrollView>
    );
}

const createStyles = () =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: Colors.background,
        },
        content: {
            paddingBottom: 40,
        },
        header: {
            paddingTop: Platform.OS === 'ios' ? 60 : 40,
            paddingBottom: 24,
            paddingHorizontal: 20,
        },
        headerTitle: {
            fontSize: 28,
            fontWeight: '800',
            color: Colors.darkGray,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 14,
            color: Colors.gray,
            lineHeight: 20,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 20,
            padding: 18,
            shadowColor: Colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
            elevation: 3,
        },
        cardIconWrap: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: Colors.lightPrimary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
        },
        cardInfo: {
            flex: 1,
            paddingRight: 8,
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: Colors.darkGray,
            marginBottom: 4,
        },
        cardDescription: {
            fontSize: 13,
            color: Colors.gray,
            lineHeight: 18,
        },
    });