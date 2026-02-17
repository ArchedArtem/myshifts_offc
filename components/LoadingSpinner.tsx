import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'; // Добавили Text
import Colors from '@/constants/Colors';

interface LoadingSpinnerProps {
    size?: 'small' | 'large';
    color?: string;
    fullScreen?: boolean;
    message?: string;
}

export default function LoadingSpinner({
                                           size = 'large',
                                           color = Colors.primary,
                                           fullScreen = true,
                                           message,
                                       }: LoadingSpinnerProps) {
    const containerStyle = fullScreen
        ? styles.fullScreenContainer
        : styles.inlineContainer;

    return (
        <View style={containerStyle}>
            <ActivityIndicator size={size} color={color} />
            {message && (
                <View style={styles.messageContainer}>
                    <Text style={styles.messageText}>{message}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    inlineContainer: {
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
    messageText: {
        fontSize: 16,
        color: Colors.gray,
        textAlign: 'center',
    },
});