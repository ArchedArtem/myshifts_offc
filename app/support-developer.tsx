import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from '@/utils/haptics';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

const DONATION_AMOUNTS = [100, 300, 500];

export default function SupportDeveloperScreen() {
  useTheme();
  const router = useRouter();
  const styles = createStyles();

  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const finalAmount = customAmount ? parseInt(customAmount) : selectedAmount;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/profile');
  };

  const handleDonate = async () => {
    if (!finalAmount || finalAmount < 5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Ошибка', 'Минимальная сумма для перевода — 5 ₽');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const shopId = "1284102";
      const paymentUrl = `https://yookassa.ru/integration/simplepay/payment?shopId=${shopId}&sum=${finalAmount}`;

      await WebBrowser.openBrowserAsync(paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: Colors.primary,
      });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось открыть страницу оплаты.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={styles.backButtonText}>Профиль</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Поддержать проект ❤️</Text>
          <Text style={styles.subtitle}>
            «Мои смены» разрабатывается одним человеком. Ваша поддержка помогает оплачивать серверы, развивать AI-сканер и выпускать новые функции.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Выберите сумму поддержки</Text>

          <View style={styles.amountsRow}>
            {DONATION_AMOUNTS.map((amount) => (
                <TouchableOpacity
                    key={amount}
                    style={[
                      styles.amountButton,
                      selectedAmount === amount && styles.amountButtonSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAmount(amount);
                      setCustomAmount('');
                    }}
                    activeOpacity={0.8}
                >
                  <Text style={[
                    styles.amountText,
                    selectedAmount === amount && styles.amountTextSelected
                  ]}>
                    {amount} ₽
                  </Text>
                </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customAmountContainer}>
            <Text style={styles.label}>Своя сумма</Text>
            <View style={styles.inputWrap}>
              <TextInput
                  style={[
                    styles.customInput,
                    customAmount !== '' && styles.customInputActive
                  ]}
                  placeholder="Введите сумму..."
                  placeholderTextColor={Colors.gray}
                  keyboardType="number-pad"
                  maxLength={5}
                  value={customAmount}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setCustomAmount(numericValue);
                    setSelectedAmount(0);
                  }}
              />
              {customAmount !== '' && <Text style={styles.currencySuffix}>₽</Text>}
            </View>
          </View>

          <TouchableOpacity
              style={[styles.payButton, (!finalAmount || finalAmount < 5) && styles.payButtonDisabled]}
              onPress={handleDonate}
              activeOpacity={0.85}
              disabled={isLoading || !finalAmount || finalAmount < 5}
          >
            {isLoading ? (
                <ActivityIndicator color={Colors.onPrimary} />
            ) : (
                <Text style={styles.payButtonText}>
                  Поддержать на {finalAmount || 0} ₽
                </Text>
            )}
          </TouchableOpacity>

          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.gray} />
            <Text style={styles.secureText}>Безопасная оплата через ЮKassa</Text>
          </View>
        </View>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    paddingBottom: 40
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 16,
    textAlign: 'center',
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  amountButton: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  amountButtonSelected: {
    backgroundColor: Colors.lightPrimary,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gray,
  },
  amountTextSelected: {
    color: Colors.primary,
  },
  customAmountContainer: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  customInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  customInputActive: {
    color: Colors.primary,
  },
  currencySuffix: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 8,
  },
  payButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payButtonDisabled: {
    backgroundColor: Colors.gray,
    shadowOpacity: 0,
    elevation: 0,
  },
  payButtonText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureText: {
    fontSize: 12,
    color: Colors.gray,
    fontWeight: '500',
    marginLeft: 4,
  }
});