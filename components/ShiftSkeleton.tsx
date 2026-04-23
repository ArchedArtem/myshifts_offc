import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

export default function ShiftSkeleton() {
    useTheme();
    const styles = createStyles(); // Динамическое создание стилей

    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [opacity]);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Animated.View style={[styles.timeBlock, { opacity }]} />
                <Animated.View style={[styles.badgeBlock, { opacity }]} />
            </View>
            <Animated.View style={[styles.rateBlock, { opacity }]} />
            <Animated.View style={[styles.totalBlock, { opacity }]} />
        </View>
    );
}

const createStyles = () => StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    timeBlock: {
        width: 130,
        height: 20,
        backgroundColor: Colors.lightGray,
        borderRadius: 6,
    },
    badgeBlock: {
        width: 60,
        height: 24,
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
    },
    rateBlock: {
        width: '50%',
        height: 14,
        backgroundColor: Colors.lightGray,
        borderRadius: 6,
        marginBottom: 10,
    },
    totalBlock: {
        width: '35%',
        height: 18,
        backgroundColor: Colors.lightGray,
        borderRadius: 6,
    },
});