import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import * as Haptics from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [loading, setLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [acceptedLegal, setAcceptedLegal] = useState(false);

    const router = useRouter();
    const { sendOTP, verifyOTP } = useAuth();
    useTheme();
    const styles = createStyles();

    const otpInputs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        if (resendCountdown > 0) {
            const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCountdown]);

    const openTerms = () => router.push('/legal?doc=terms');
    const openPrivacy = () => router.push('/legal?doc=privacy');

    const handleSendOTP = async () => {
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Ошибка', 'Введите корректный email');
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await sendOTP(trimmedEmail);
            setStep('otp');
            setResendCountdown(30);

            setTimeout(() => {
                otpInputs.current[0]?.focus();
            }, 100);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Ошибка', error.message || 'Не удалось отправить код');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendCountdown > 0) return;
        handleSendOTP();
    };

    const handleVerifyOTP = async (codeOverride?: string) => {
        const code = codeOverride ?? otp.join('');
        if (code.length !== 6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Ошибка', 'Введите полный 6-значный код');
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await verifyOTP(email.trim().toLowerCase(), code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(app)');
        } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Ошибка', 'Неверный код или время истекло');
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            otpInputs.current[index + 1]?.focus();
        }

        const fullCode = newOtp.join('');
        if (index === 5 && value && fullCode.length === 6) {
            handleVerifyOTP(fullCode);
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.screen}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="calendar" size={40} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Мои смены</Text>
                    <Text style={styles.subtitle}>Простой учет рабочих графиков и заработка</Text>
                </View>

                <View style={styles.card}>
                    {step === 'email' ? (
                        <View style={styles.stepContainer}>
                            <Text style={styles.label}>Электронная почта</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="example@mail.ru"
                                placeholderTextColor={Colors.gray}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                            />

                            <View style={styles.legalRow}>
                                <TouchableOpacity
                                    style={[styles.checkbox, acceptedLegal && styles.checkboxChecked]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setAcceptedLegal(!acceptedLegal);
                                    }}
                                    activeOpacity={0.8}
                                    disabled={loading}
                                >
                                    {acceptedLegal && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                                </TouchableOpacity>
                                <Text style={styles.legalText}>
                                    Я принимаю{' '}
                                    <Text style={styles.legalLink} onPress={openTerms}>Соглашение</Text>
                                    {' '}и{' '}
                                    <Text style={styles.legalLink} onPress={openPrivacy}>Политику данных</Text>
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    (loading || !acceptedLegal || !email.includes('@')) && styles.buttonDisabled
                                ]}
                                onPress={handleSendOTP}
                                disabled={loading || !acceptedLegal || !email.includes('@')}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.onPrimary} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Получить код</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.stepContainer}>
                            <View style={styles.otpHeader}>
                                <Text style={styles.label}>Введите код из письма</Text>
                                <Text style={styles.emailSubtext}>{email}</Text>
                            </View>

                            <View style={styles.otpRow}>
                                {otp.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { otpInputs.current[index] = ref; }}
                                        style={styles.otpInput}
                                        value={digit}
                                        onChangeText={(value) => handleOtpChange(value, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        editable={!loading}
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={() => handleVerifyOTP()}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.onPrimary} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Войти</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.otpFooter}>
                                <TouchableOpacity onPress={handleResendOTP} disabled={resendCountdown > 0 || loading}>
                                    <Text style={[styles.secondaryLink, resendCountdown > 0 && styles.disabledLink]}>
                                        {resendCountdown > 0
                                            ? `Отправить повторно через ${resendCountdown}с`
                                            : 'Отправить код еще раз'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setStep('email');
                                        setOtp(['', '', '', '', '', '']);
                                    }}
                                    disabled={loading}
                                >
                                    <Text style={styles.secondaryLink}>Изменить почту</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.secureBadge}>
                    <Text style={styles.secureText}>Безопасный вход без пароля</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const createStyles = () => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.darkGray,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.gray,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 24,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 4,
    },
    stepContainer: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.darkGray,
        marginBottom: 10,
        marginLeft: 4,
    },
    input: {
        backgroundColor: Colors.lightGray,
        borderRadius: 14,
        padding: 16,
        fontSize: 16,
        color: Colors.darkGray,
        fontWeight: '500',
        marginBottom: 16,
    },
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        backgroundColor: Colors.white,
    },
    checkboxChecked: {
        borderColor: Colors.primary,
        backgroundColor: Colors.lightPrimary,
    },
    legalText: {
        flex: 1,
        fontSize: 13,
        color: Colors.gray,
        lineHeight: 18,
    },
    legalLink: {
        color: Colors.primary,
        fontWeight: '600',
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: Colors.gray,
        shadowOpacity: 0,
        elevation: 0,
    },
    primaryButtonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    otpHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    emailSubtext: {
        fontSize: 15,
        color: Colors.primary,
        fontWeight: '600',
        marginTop: 4,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    otpInput: {
        width: 44,
        height: 56,
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: '800',
        color: Colors.darkGray,
    },
    otpFooter: {
        marginTop: 24,
        alignItems: 'center',
        gap: 16,
    },
    secondaryLink: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    disabledLink: {
        color: Colors.gray,
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
    },
    secureText: {
        fontSize: 13,
        color: Colors.gray,
        marginLeft: 6,
        fontWeight: '500',
    },
});