import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from '@/utils/haptics';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

const DONATION_AMOUNTS = [100, 300, 500];

export default function SupportDeveloperScreen() {
  useTheme();
  const router = useRouter();
  const styles = createStyles();

  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Считаем итоговую сумму для кнопки
  const finalAmount = customAmount ? parseInt(customAmount) : selectedAmount;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/profile');
  };

  const handleDonate = async () => {
    if (!finalAmount || finalAmount < 5) {
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
        toolbarColor: Colors.background,
      });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось открыть страницу оплаты.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Поддержать проект ❤️</Text>
        <Text style={styles.subtitle}>
          «Мои смены» разрабатывается одним человеком. Ваша поддержка помогает оплачивать серверы (включая AI-сканер) и выпускать обновления!
        </Text>

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
            <TextInput
                style={[
                  styles.customInput,
                  customAmount !== '' && styles.customInputSelected
                ]}
                placeholder="Другая сумма"
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
            {customAmount !== '' && (
                <Text style={styles.currencyIcon}>₽</Text>
            )}
          </View>

          <TouchableOpacity
              style={[styles.payButton, (!finalAmount || finalAmount < 5) && styles.payButtonDisabled]}
              onPress={handleDonate}
              activeOpacity={0.85}
              disabled={isLoading || !finalAmount || finalAmount < 5}
          >
            <Text style={styles.payButtonText}>
              {isLoading ? 'Загрузка...' : `Поддержать на ${finalAmount || 0} ₽`}
            </Text>
          </TouchableOpacity>

          <Text style={styles.secureText}>🔒 Оплата безопасно через ЮKassa</Text>
        </View>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  title: { fontSize: 24, fontWeight: '800', color: Colors.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray, lineHeight: 20, marginBottom: 20 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: { fontSize: 15, fontWeight: '600', color: Colors.darkGray, marginBottom: 16 },

  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  amountButton: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  amountButtonSelected: {
    backgroundColor: Colors.lightPrimary,
    borderColor: Colors.primary,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray,
  },
  amountTextSelected: {
    color: Colors.primary,
  },

  // Стили для поля ввода своей суммы
  customAmountContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 20,
  },
  customInput: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  customInputSelected: {
    backgroundColor: Colors.lightPrimary,
    borderColor: Colors.primary,
    color: Colors.primary,
  },
  currencyIcon: {
    position: 'absolute',
    right: 16,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },

  payButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  payButtonText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secureText: {
    fontSize: 12,
    color: Colors.gray,
    fontWeight: '500',
  }
});