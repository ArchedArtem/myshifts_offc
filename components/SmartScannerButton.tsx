// Файл: components/SmartScannerButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Check, X, Sparkles, Clock, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { scanScheduleImage } from '@/services/aiScanner';
import { useShifts } from '@/hooks/useShifts';
import { useAuth } from '@/hooks/useAuth';
import { loadCachedProfile } from '@/services/profileCache';

export default function SmartScannerButton() {
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null); // Стейт для ошибки в кнопке
    const [detectedShifts, setDetectedShifts] = useState<any[] | null>(null);
    const { user } = useAuth();
    const { addShift } = useShifts();

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e) {}
            processImage(result.assets[0].uri);
        }
    };

    const processImage = async (uri: string) => {
        setIsScanning(true);
        setScanError(null);
        try {
            const shifts = await scanScheduleImage(uri);
            setDetectedShifts(shifts);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch(e) {}
        } catch (error: any) {
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch(e) {}

            const errorMessage = error?.message || '';
            if (errorMessage.includes('demand') || errorMessage.includes('перегружены')) {
                setScanError('Сервера перегружены ⏳');
            } else {
                setScanError('Не удалось прочитать');
            }

            setTimeout(() => {
                setScanError(null);
            }, 3500);

        } finally {
            setIsScanning(false);
        }
    };

    const handleConfirm = async () => {
        if (!detectedShifts || !user) return;

        try {
            const profile = await loadCachedProfile(user.id);
            const userRate = profile.default_hourly_rate ?? 0;

            for (const shift of detectedShifts) {
                await addShift({
                    date: shift.date,
                    start_time: shift.startTime,
                    end_time: shift.endTime,
                    hourly_rate: userRate,
                    extra_payment: 0,
                    earnings: 0,
                    'break': shift.break || 0,
                    notes: shift.title || 'Смена (AI)',
                });
            }

            setDetectedShifts(null);
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e) {}
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить смены');
        }
    };

    return (
        <View>
            <TouchableOpacity
                style={[
                    styles.button,
                    isScanning && styles.buttonScanning,
                    scanError && styles.buttonError
                ]}
                onPress={handlePickImage}
                disabled={isScanning || !!scanError}
                activeOpacity={0.8}
            >
                {isScanning ? (
                    <>
                        <ActivityIndicator size="small" color={Colors.onPrimary} />
                        <Text style={styles.buttonText}>Читаю график...</Text>
                    </>
                ) : scanError ? (
                    <>
                        <AlertTriangle size={20} color={Colors.white} />
                        <Text style={styles.buttonText}>{scanError}</Text>
                    </>
                ) : (
                    <>
                        <Sparkles size={20} color={Colors.onPrimary} />
                        <Text style={styles.buttonText}>AI Сканер</Text>
                    </>
                )}
            </TouchableOpacity>

            <Modal visible={!!detectedShifts} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Sparkles size={24} color={Colors.primary} />
                            <Text style={styles.modalTitle}>Нашел новые смены!</Text>
                        </View>

                        <ScrollView style={styles.shiftsList} showsVerticalScrollIndicator={false}>
                            {detectedShifts?.map((shift, index) => (
                                <View key={index} style={styles.shiftItem}>
                                    <View style={styles.shiftDateRow}>
                                        <Text style={styles.shiftDate}>{shift.date}</Text>
                                        <Text style={styles.shiftLabel}>{shift.title}</Text>
                                    </View>

                                    <View style={styles.shiftTimeRow}>
                                        <Clock size={14} color={Colors.gray} />
                                        <Text style={styles.shiftTime}>
                                            {shift.startTime} — {shift.endTime}
                                        </Text>
                                        {shift.break > 0 && (
                                            <Text style={styles.shiftBreak}>
                                                • ☕ {shift.break} мин
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setDetectedShifts(null)}>
                                <X size={20} color={Colors.error} />
                                <Text style={styles.cancelText}>Отмена</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={handleConfirm}>
                                <Check size={20} color={Colors.onPrimary} />
                                <Text style={styles.confirmText}>Добавить все</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30,
        elevation: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        gap: 8,
    },
    buttonScanning: {
        backgroundColor: Colors.secondary,
    },
    buttonError: {
        backgroundColor: Colors.error,
        shadowColor: Colors.error,
    },
    buttonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        gap: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.darkGray,
    },
    shiftsList: {
        marginBottom: 24,
    },
    shiftItem: {
        backgroundColor: Colors.lightGray,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    shiftDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    shiftDate: {
        fontWeight: '700',
        fontSize: 16,
        color: Colors.darkGray,
    },
    shiftLabel: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '600',
        backgroundColor: Colors.lightPrimary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    shiftTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    shiftTime: {
        color: Colors.gray,
        fontSize: 14,
        fontWeight: '500',
    },
    shiftBreak: {
        color: Colors.gray,
        fontSize: 14,
        fontWeight: '500',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    cancelBtn: {
        backgroundColor: Colors.lightError,
    },
    confirmBtn: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    cancelText: {
        color: Colors.error,
        fontWeight: '700',
        fontSize: 16,
    },
    confirmText: {
        color: Colors.onPrimary,
        fontWeight: '700',
        fontSize: 16,
    },
});