import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [loading, setLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const router = useRouter();
    const { sendOTP, verifyOTP } = useAuth();
    useTheme();
    const styles = createStyles();

    const otpInputs = useRef<(TextInput | null)[]>([]);

    const handleSendOTP = async () => {
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            Alert.alert('Ошибка', 'Введите корректный email');
            return;
        }

        setLoading(true);
        try {
            await sendOTP(trimmedEmail);
            setStep('otp');
            setResendCountdown(30);

            // Автофокус на первый OTP инпут
            setTimeout(() => {
                otpInputs.current[0]?.focus();
            }, 100);

            Alert.alert('Успешно', '6-значный код отправлен на вашу почту');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось отправить код');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendCountdown > 0) return;

        const trimmedEmail = email.trim().toLowerCase();
        setLoading(true);
        try {
            await sendOTP(trimmedEmail);
            setResendCountdown(30);
            Alert.alert('Успешно', 'Новый код отправлен');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось отправить код');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (codeOverride?: string) => {
        const code = codeOverride ?? otp.join('');
        if (code.length !== 6) {
            Alert.alert('Ошибка', 'Введите полный 6-значный код');
            return;
        }

        setLoading(true);
        try {
            await verifyOTP(email.trim().toLowerCase(), code);
            router.replace('/(app)');
        } catch (error: any) {
            Alert.alert('Ошибка', 'Неверный код или время истекло');
            // Сброс OTP полей
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        // Только цифры
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Автопереход к следующему полю
        if (value && index < 5) {
            otpInputs.current[index + 1]?.focus();
        }

        // Автоматическая отправка при заполнении
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

    // Таймер для повторной отправки
    React.useEffect(() => {
        if (resendCountdown > 0) {
            const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCountdown]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Мои смены</Text>
                    <Text style={styles.subtitle}>Учет смен и заработка</Text>
                </View>

                {step === 'email' ? (
                    <View style={styles.emailStep}>
                        <Text style={styles.label}>Введите ваш email</Text>
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
                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSendOTP}
                            disabled={loading || !email.includes('@')}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.onPrimary} />
                            ) : (
                                <Text style={styles.buttonText}>Получить код</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.otpStep}>
                        <Text style={styles.label}>Код отправлен на</Text>
                        <Text style={styles.emailText}>{email}</Text>

                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    ref={(ref) => {
                                        otpInputs.current[index] = ref;
                                    }}
                                    style={styles.otpInput}
                                    value={digit}
                                    onChangeText={(value) => handleOtpChange(value, index)}
                                    onKeyPress={(e) => handleKeyPress(e, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    editable={!loading}
                                    selectTextOnFocus
                                    placeholderTextColor={Colors.gray}
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={() => { void handleVerifyOTP(); }}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.onPrimary} />
                            ) : (
                                <Text style={styles.buttonText}>Войти</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={handleResendOTP}
                                disabled={resendCountdown > 0 || loading}
                            >
                                <Text style={[
                                    styles.resendText,
                                    (resendCountdown > 0 || loading) && styles.resendTextDisabled
                                ]}>
                                    {resendCountdown > 0
                                        ? `Отправить повторно (${resendCountdown}с)`
                                        : 'Отправить код повторно'
                                    }
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setStep('email');
                                    setOtp(['', '', '', '', '', '']);
                                }}
                                disabled={loading}
                            >
                                <Text style={styles.changeEmailText}>Изменить email</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.gray,
        textAlign: 'center',
    },
    emailStep: {
        width: '100%',
    },
    otpStep: {
        width: '100%',
    },
    label: {
        fontSize: 16,
        color: Colors.darkGray,
        marginBottom: 12,
        fontWeight: '500',
    },
    emailText: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.primary,
        marginBottom: 32,
    },
    input: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 20,
        color: Colors.darkGray,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    otpInput: {
        width: 48,
        height: 56,
        backgroundColor: Colors.white,
        borderWidth: 2,
        borderColor: Colors.border,
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.darkGray,
    },
    button: {
        backgroundColor: Colors.primary,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        backgroundColor: Colors.gray,
        opacity: 0.7,
    },
    buttonText: {
        color: Colors.onPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        marginTop: 8,
    },
    resendText: {
        color: Colors.primary,
        fontSize: 14,
        marginBottom: 16,
    },
    resendTextDisabled: {
        color: Colors.gray,
    },
    changeEmailText: {
        color: Colors.primary,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
});
