import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated as RNAnimated } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, Layout } from 'react-native-reanimated';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { calculateDuration, calculateEarnings, formatDuration } from '@/utils/calculations';
import * as Haptics from '@/utils/haptics';

interface ShiftCardProps {
    shift: {
        id: string | number;
        start_time: string;
        end_time: string;
        hourly_rate: number;
        extra_payment: number;
        break?: number | null;
        earnings: number;
        notes?: string | null;
        sync_state?: 'synced' | 'pending' | 'error';
    };
    onPress: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

export default function ShiftCard({ shift, onPress, onEdit, onDelete }: ShiftCardProps) {
    const swipeableRef = useRef<Swipeable>(null);

    const normalizeTime = (time: string) => time.split(':').slice(0, 2).join(':');
    const breakMinutes = shift.break ?? 0;

    const getDurationLabel = () => {
        const durationInHours = calculateDuration(
            normalizeTime(shift.start_time),
            normalizeTime(shift.end_time),
            breakMinutes
        );
        return formatDuration(durationInHours);
    };

    const earnings = calculateEarnings(
        normalizeTime(shift.start_time),
        normalizeTime(shift.end_time),
        shift.hourly_rate ?? 0,
        shift.extra_payment ?? 0,
        breakMinutes,
    );

    const renderLeftActions = (progress: any, dragX: any) => {
        const scale = dragX.interpolate({
            inputRange: [0, 80],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
        return (
            <TouchableOpacity
                style={styles.leftAction}
                onPress={() => {
                    swipeableRef.current?.close();
                    if (onEdit) onEdit();
                }}
            >
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="pencil" size={24} color={Colors.white} />
                </RNAnimated.View>
            </TouchableOpacity>
        );
    };

    const renderRightActions = (progress: any, dragX: any) => {
        const scale = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });
        return (
            <TouchableOpacity
                style={styles.rightAction}
                onPress={() => {
                    swipeableRef.current?.close();
                    if (onDelete) onDelete();
                }}
            >
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="trash" size={24} color={Colors.white} />
                </RNAnimated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Animated.View
            entering={FadeInUp.duration(400)}
            exiting={FadeOutDown.duration(300)}
            layout={Layout.springify()}
            style={styles.animatedWrapper}
        >
            <Swipeable
                ref={swipeableRef}
                renderLeftActions={onEdit ? renderLeftActions : undefined}
                renderRightActions={onDelete ? renderRightActions : undefined}
                friction={2}
                rightThreshold={40}
                leftThreshold={40}
                overshootLeft={false}
                overshootRight={false}
                onSwipeableOpen={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
            >
                <TouchableOpacity
                    style={styles.card}
                    onPress={onPress}
                    activeOpacity={1}
                >
                    <View style={styles.headerRow}>
                        <Text style={styles.timeText}>
                            {normalizeTime(shift.start_time)}
                        </Text>
                        <Text style={styles.dashText}>—</Text>
                        <Text style={styles.timeText}>
                            {normalizeTime(shift.end_time)}
                        </Text>
                        <Text style={styles.durationText}>
                            ({getDurationLabel()})
                        </Text>
                    </View>

                    <View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>
                                {shift.hourly_rate} ₽/час
                            </Text>
                            {breakMinutes > 0 && (
                                <Text style={styles.infoTextDivider}>
                                    • Перерыв: {breakMinutes} мин
                                </Text>
                            )}
                            {shift.extra_payment > 0 && (
                                <Text style={styles.extraPaymentText}>
                                    +{shift.extra_payment} ₽
                                </Text>
                            )}
                        </View>

                        <Text style={styles.earningsText}>
                            {earnings.toFixed(2)} ₽
                        </Text>

                        {shift.sync_state && shift.sync_state !== 'synced' && (
                            <View style={[
                                styles.syncBadge,
                                {
                                    backgroundColor: shift.sync_state === 'error' ? Colors.lightError : Colors.lightPrimary,
                                    borderColor: shift.sync_state === 'error' ? Colors.error : Colors.primary,
                                }
                            ]}>
                                <Text style={[
                                    styles.syncBadgeText,
                                    { color: shift.sync_state === 'error' ? Colors.error : Colors.primary }
                                ]}>
                                    {shift.sync_state === 'error' ? 'Ошибка синхронизации' : 'Не синхронизировано'}
                                </Text>
                            </View>
                        )}

                        {shift.notes && (
                            <Text style={styles.notesText} numberOfLines={1}>
                                📝 {shift.notes}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Swipeable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    animatedWrapper: {
        marginBottom: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        backgroundColor: Colors.white,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
    },
    leftAction: {
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        width: 85,
        borderRadius: 12,
    },
    rightAction: {
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        width: 85,
        borderRadius: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    timeText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.darkGray,
    },
    dashText: {
        fontSize: 16,
        color: Colors.gray,
        marginHorizontal: 8,
    },
    durationText: {
        fontSize: 14,
        color: Colors.gray,
        marginLeft: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    infoText: {
        fontSize: 14,
        color: Colors.gray,
    },
    infoTextDivider: {
        fontSize: 14,
        color: Colors.gray,
        marginLeft: 8,
    },
    extraPaymentText: {
        fontSize: 14,
        color: Colors.success,
        marginLeft: 8,
        fontWeight: '500',
    },
    earningsText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 8,
    },
    syncBadge: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 8,
    },
    syncBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    notesText: {
        fontSize: 14,
        color: Colors.gray,
        fontStyle: 'italic',
    },
});