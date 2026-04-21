import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from '@/utils/haptics';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

export default function SupportDeveloperScreen() {
  useTheme();
  const router = useRouter();
  const styles = createStyles();

  const [copied, setCopied] = useState(false);
  const cardNumber = "2200 2404 1967 7543";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/profile');
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(cardNumber.replace(/\s/g, ''));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Поддержать разработчика ❤️</Text>
        <Text style={styles.subtitle}>
          Спасибо за поддержку проекта «Мои смены». Любая сумма помогает развивать приложение.
        </Text>

        <TouchableOpacity
            style={[styles.card, copied && styles.cardCopied]}
            onPress={handleCopy}
            activeOpacity={0.8}
        >
          <Text style={styles.cardLabel}>Реквизиты для перевода</Text>
          <Text style={styles.bank}>ВТБ</Text>
          <Text style={styles.cardNumber}>{cardNumber}</Text>

          <View style={[styles.hintBadge, copied && styles.hintBadgeCopied]}>
            <Text style={[styles.hint, copied && styles.hintCopied]}>
              {copied ? '✅ Скопировано!' : 'Нажмите, чтобы скопировать'}
            </Text>
          </View>
        </TouchableOpacity>
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
  subtitle: { fontSize: 14, color: Colors.gray, lineHeight: 20, marginBottom: 14 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'center',
  },
  cardCopied: {
    borderColor: Colors.success,
  },
  cardLabel: { fontSize: 13, color: Colors.gray, marginBottom: 8 },
  bank: { fontSize: 18, fontWeight: '700', color: Colors.darkGray, marginBottom: 10 },
  cardNumber: { fontSize: 28, fontWeight: '800', letterSpacing: 1, color: Colors.primary, marginBottom: 12 },

  hintBadge: {
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  hintBadgeCopied: {
    backgroundColor: Colors.success,
  },
  hint: { fontSize: 13, color: Colors.darkGray, fontWeight: '500' },
  hintCopied: { color: Colors.white, fontWeight: '600' },
});