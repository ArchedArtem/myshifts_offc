import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

interface ModernLoaderProps {
    fullScreen?: boolean;
}

export default function ModernLoader({ fullScreen = true }: ModernLoaderProps) {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const opacityValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleValue, { toValue: 1.15, duration: 800, useNativeDriver: true }),
                    Animated.timing(opacityValue, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleValue, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(opacityValue, { toValue: 1, duration: 800, useNativeDriver: true }),
                ]),
            ])
        ).start();
    }, [scaleValue, opacityValue]);

    return (
        <View style={fullScreen ? styles.fullScreenContainer : styles.inlineContainer}>
            <Animated.Image
                source={require('@/assets/images/icon.png')}
                style={[
                    styles.logo,
                    {
                        transform: [{ scale: scaleValue }],
                        opacity: opacityValue,

                    }
                ]}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    inlineContainer: {
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 80,
        height: 80,
    },
});