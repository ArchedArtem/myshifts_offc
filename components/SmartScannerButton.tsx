import React, {useState} from 'react';
import {TouchableOpacity, Text, StyleSheet, View, Modal, ScrollView, Alert, ActivityIndicator, TextInput} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {Camera, Check, X, Sparkles, Clock, AlertTriangle, Image as ImageIcon} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/Colors';
import {scanScheduleImage} from '@/services/aiScanner';
import {useShifts} from '@/hooks/useShifts';
import {useAuth} from '@/hooks/useAuth';
import {loadCachedProfile} from '@/services/profileCache';
import { useTheme } from '@/hooks/useTheme';

export default function SmartScannerButton() {
    useTheme();
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [detectedShifts, setDetectedShifts] = useState<any[] | null>(null);
    const [showIntro, setShowIntro] = useState(false); // Стейт для инструкции
    const {user} = useAuth();
    const {addShift} = useShifts();

    const formatScanDate = (dateString: string) => {
        try {
            const date = new Date(`${dateString}T12:00:00`);

            if (isNaN(date.getTime())) return dateString;

            let formatted = date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                weekday: 'short',
            }).replace(' г.', '');

            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        } catch (e) {
            return dateString;
        }
    };

    const updateShiftField = (index: number, field: string, value: string | number) => {
        setDetectedShifts((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleScannerPress = async () => {
        try {
            const hasSeenIntro = await AsyncStorage.getItem('@ai_scanner_intro_seen');

            if (hasSeenIntro === 'true') {
                handlePickImage();
            } else {
                try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {
                }
                setShowIntro(true);
            }
        } catch (error) {
            handlePickImage();
        }
    };

    const handleStartAfterIntro = async () => {
        try {
            await AsyncStorage.setItem('@ai_scanner_intro_seen', 'true');
            setShowIntro(false);
            setTimeout(() => {
                handlePickImage();
            }, 300);
        } catch (error) {
            setShowIntro(false);
            handlePickImage();
        }
    };

    const handlePickImage = async () => {
        const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.4,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
            }
            processImage(result.assets[0].uri);
        }
    };

    const processImage = async (uri: string) => {
        setIsScanning(true);
        setScanError(null);
        try {
            const shifts = await scanScheduleImage(uri);
            if (shifts.length === 0) {
                throw new Error('empty_shifts');
            }
            setDetectedShifts(shifts);
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {}
        } catch (error: any) {
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch (e) {}

            const msg = (error?.message || '').toLowerCase();

            if (msg === 'empty_shifts') {
                setScanError('Смены не найдены 🧐');
            } else {
                const isOverloaded =
                    msg.includes('demand') ||
                    msg.includes('overloaded') ||
                    msg.includes('temporary') ||
                    msg.includes('quota') ||
                    msg.includes('limit') ||
                    msg.includes('перегружены') ||
                    msg.includes('429') ||
                    msg.includes('503');

                if (isOverloaded) {
                    setScanError('Сервера перегружены ⏳');
                } else {
                    setScanError('Не удалось прочитать ❌');
                }
            }

            setTimeout(() => {
                setScanError(null);
            }, 4000);
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
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e) {
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить смены');
        }
    };

    return (
        <View>
            <TouchableOpacity
                style={[styles.button, isScanning && styles.buttonScanning, scanError && styles.buttonError]}
                onPress={handleScannerPress}
                disabled={isScanning || !!scanError}
                activeOpacity={0.8}
            >
                {isScanning ? (
                    <>
                        <ActivityIndicator size="small" color={Colors.onPrimary}/>
                        <Text style={styles.buttonText}>Читаю график...</Text>
                    </>
                ) : scanError ? (
                    <>
                        <AlertTriangle size={20} color={Colors.white}/>
                        <Text style={styles.buttonText}>{scanError}</Text>
                    </>
                ) : (
                    <>
                        <Sparkles size={20} color={Colors.onPrimary}/>
                        <Text style={styles.buttonText}>AI Сканер</Text>
                    </>
                )}
            </TouchableOpacity>

            <Modal visible={showIntro} animationType="fade" transparent={true}>
                <View style={styles.modalOverlayIntro}>
                    <View style={styles.modalContentIntro}>
                        <View style={styles.introHeader}>
                            <Sparkles size={32} color={Colors.primary}/>
                            <Text style={styles.introTitle}>Как работает AI-сканер?</Text>
                            <Text style={styles.introSubtitle}>
                                Забудьте про ручной ввод. Нейросеть сделает всё за вас за пару секунд.
                            </Text>
                        </View>

                        <View style={styles.introSteps}>
                            <View style={styles.stepItem}>
                                <View style={styles.stepIconBg}><Camera size={20} color={Colors.primary}/></View>
                                <Text style={styles.stepText}>Сфотографируйте свой график или загрузите скриншот</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <View style={styles.stepIconBg}><Sparkles size={20} color={Colors.primary}/></View>
                                <Text style={styles.stepText}>Умный ИИ сам найдет даты, время работы и посчитает
                                    перерывы</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <View style={styles.stepIconBg}><Check size={20} color={Colors.primary}/></View>
                                <Text style={styles.stepText}>Проверьте результат и сохраните все смены в один
                                    клик</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.introButton} onPress={handleStartAfterIntro}
                                          activeOpacity={0.8}>
                            <Text style={styles.introButtonText}>Понятно, поехали!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!detectedShifts} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Sparkles size={24} color={Colors.primary}/>
                            <Text style={styles.modalTitle}>Нашел новые смены!</Text>
                        </View>

                        <ScrollView style={styles.shiftsList} showsVerticalScrollIndicator={false}>
                            {detectedShifts?.map((shift, index) => (
                                <View key={index} style={styles.shiftItem}>
                                    <View style={styles.shiftDateRow}>
                                        <Text style={styles.shiftDate}>
                                            {formatScanDate(shift.date)}
                                        </Text>
                                        <TextInput
                                            style={styles.shiftLabelInput}
                                            value={shift.title}
                                            onChangeText={(text) => updateShiftField(index, 'title', text)}
                                            placeholder="Название"
                                            placeholderTextColor={Colors.gray}
                                        />
                                    </View>

                                    <View style={styles.shiftTimeRow}>
                                        <Clock size={14} color={Colors.gray}/>
                                        <TextInput
                                            style={styles.timeInput}
                                            value={shift.startTime}
                                            onChangeText={(text) => updateShiftField(index, 'startTime', text)}
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={5}
                                        />
                                        <Text style={styles.timeSeparator}>—</Text>
                                        <TextInput
                                            style={styles.timeInput}
                                            value={shift.endTime}
                                            onChangeText={(text) => updateShiftField(index, 'endTime', text)}
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={5}
                                        />

                                        <View style={styles.breakEditRow}>
                                            <Text style={styles.shiftBreak}>• ☕</Text>
                                            <TextInput
                                                style={styles.breakInput}
                                                value={shift.break?.toString() || '0'}
                                                onChangeText={(text) => updateShiftField(index, 'break', parseInt(text) || 0)}
                                                keyboardType="numeric"
                                                maxLength={3}
                                            />
                                            <Text style={styles.shiftBreak}>мин</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]}
                                              onPress={() => setDetectedShifts(null)}>
                                <X size={20} color={Colors.error}/>
                                <Text style={styles.cancelText}>Отмена</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={handleConfirm}>
                                <Check size={20} color={Colors.onPrimary}/>
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
    shiftLabelInput: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '600',
        backgroundColor: Colors.lightPrimary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        minWidth: 60,
        maxWidth: 100,
        textAlign: 'center',
    },
    timeInput: {
        color: Colors.darkGray,
        fontSize: 15,
        fontWeight: '600',
        backgroundColor: Colors.white,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        textAlign: 'center',
        width: 55,
    },
    timeSeparator: {
        color: Colors.gray,
        fontSize: 14,
        fontWeight: '500',
        marginHorizontal: 2,
    },
    breakEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    breakInput: {
        color: Colors.darkGray,
        fontSize: 14,
        fontWeight: '600',
        backgroundColor: Colors.white,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        textAlign: 'center',
        minWidth: 35,
    },
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
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        gap: 8,
    },
    buttonScanning: {backgroundColor: Colors.secondary},
    buttonError: {backgroundColor: Colors.error, shadowColor: Colors.error},
    buttonText: {color: Colors.onPrimary, fontSize: 16, fontWeight: '700'},

    modalOverlay: {flex: 1, justifyContent: 'flex-end'},
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '85%',
    },
    modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 10},
    modalTitle: {fontSize: 22, fontWeight: '800', color: Colors.darkGray},
    shiftsList: {marginBottom: 24},
    shiftItem: {
        backgroundColor: Colors.lightGray,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    shiftDateRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
    shiftDate: {fontWeight: '700', fontSize: 16, color: Colors.darkGray},
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
    shiftTimeRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
    shiftTime: {color: Colors.gray, fontSize: 14, fontWeight: '500'},
    shiftBreak: {color: Colors.gray, fontSize: 14, fontWeight: '500'},
    modalActions: {flexDirection: 'row', gap: 12},
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8
    },
    cancelBtn: {backgroundColor: Colors.lightError},
    confirmBtn: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    cancelText: {color: Colors.error, fontWeight: '700', fontSize: 16},
    confirmText: {color: Colors.onPrimary, fontWeight: '700', fontSize: 16},

    modalOverlayIntro: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContentIntro: {
        backgroundColor: Colors.white,
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    introHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    introTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.darkGray,
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    introSubtitle: {
        fontSize: 14,
        color: Colors.gray,
        textAlign: 'center',
        lineHeight: 20,
    },
    introSteps: {
        width: '100%',
        marginBottom: 28,
        gap: 16,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.lightGray,
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    stepIconBg: {
        backgroundColor: Colors.lightPrimary,
        padding: 10,
        borderRadius: 12,
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: Colors.darkGray,
        fontWeight: '500',
        lineHeight: 20,
    },
    introButton: {
        backgroundColor: Colors.primary,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    introButtonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
});