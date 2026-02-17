import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import { calculateDuration, calculateEarnings, formatDuration } from '@/utils/calculations';

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
    };
    onPress: () => void;
}

export default function ShiftCard({ shift, onPress }: ShiftCardProps) {
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

    return (
        <TouchableOpacity
            style={{
                backgroundColor: Colors.white,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
            }}
            onPress={onPress}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray }}>
                    {normalizeTime(shift.start_time)}
                </Text>
                <Text style={{ fontSize: 16, color: Colors.gray, marginHorizontal: 8 }}>—</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.darkGray }}>
                    {normalizeTime(shift.end_time)}
                </Text>
                <Text style={{ fontSize: 14, color: Colors.gray, marginLeft: 8 }}>
                    ({getDurationLabel()})
                </Text>
            </View>

            <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14, color: Colors.gray }}>
                        {shift.hourly_rate} ₽/час
                    </Text>
                    {breakMinutes > 0 && (
                        <Text style={{ fontSize: 14, color: Colors.gray, marginLeft: 8 }}>
                            • Перерыв: {breakMinutes} мин
                        </Text>
                    )}
                    {shift.extra_payment > 0 && (
                        <Text style={{ fontSize: 14, color: Colors.success, marginLeft: 8, fontWeight: '500' }}>
                            +{shift.extra_payment} ₽
                        </Text>
                    )}
                </View>

                <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.primary, marginBottom: 8 }}>
                    {earnings.toFixed(2)} ₽
                </Text>

                {shift.notes && (
                    <Text style={{ fontSize: 14, color: Colors.gray, fontStyle: 'italic' }} numberOfLines={1}>
                        📝 {shift.notes}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}
