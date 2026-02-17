import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

interface EarningsCardProps {
    title: string;
    amount: number;
    currency?: string;
    period?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: number;
}

export default function EarningsCard({
                                         title,
                                         amount,
                                         currency = '₽',
                                         period,
                                         trend = 'neutral',
                                         trendValue = 0,
                                     }: EarningsCardProps) {
    const getTrendColor = () => {
        switch (trend) {
            case 'up': return Colors.success;
            case 'down': return Colors.error;
            default: return Colors.gray;
        }
    };

    const getTrendIcon = () => {
        switch (trend) {
            case 'up': return '↗';
            case 'down': return '↘';
            default: return '→';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {period && (
                    <Text style={styles.period}>{period}</Text>
                )}
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.amount}>
                    {amount.toFixed(2)}
                    <Text style={styles.currency}>{currency}</Text>
                </Text>

                {(trend !== 'neutral' && trendValue !== 0) && (
                    <View style={[styles.trendBadge, { backgroundColor: getTrendColor() + '20' }]}>
                        <Text style={[styles.trendText, { color: getTrendColor() }]}>
                            {getTrendIcon()} {Math.abs(trendValue).toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${Math.min(100, amount / 100000 * 100)}%`,
                            backgroundColor: Colors.primary,
                        }
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.darkGray,
    },
    period: {
        fontSize: 14,
        color: Colors.gray,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    amount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    currency: {
        fontSize: 20,
        fontWeight: '600',
        color: Colors.primary,
        marginLeft: 4,
    },
    trendBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '600',
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.lightGray,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
});