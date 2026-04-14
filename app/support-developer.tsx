import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

export default function SupportDeveloperScreen() {
  useTheme();
  const styles = createStyles();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Поддержать разработчика ❤️</Text>
      <Text style={styles.subtitle}>
        Спасибо за поддержку проекта «Мои смены». Любая сумма помогает развивать приложение.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Реквизиты для перевода</Text>
        <Text style={styles.bank}>ВТБ</Text>
        <Text style={styles.cardNumber}>2200 2404 1967 7543</Text>
        <Text style={styles.hint}>Перевод по номеру карты</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 24 },
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
  cardLabel: { fontSize: 13, color: Colors.gray, marginBottom: 8 },
  bank: { fontSize: 18, fontWeight: '700', color: Colors.darkGray, marginBottom: 10 },
  cardNumber: { fontSize: 28, fontWeight: '800', letterSpacing: 1, color: Colors.primary, marginBottom: 8 },
  hint: { fontSize: 13, color: Colors.gray },
});
