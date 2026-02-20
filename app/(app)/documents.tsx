import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import Colors from '@/constants/Colors';

const PRIVACY_URL = 'https://myshifts.ru/privacy.html';
const TERMS_URL = 'https://myshifts.ru/terms.html';

async function openExternalUrl(url: string, errorTitle: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert('Ошибка', errorTitle);
    return;
  }

  await Linking.openURL(url);
}

export default function DocumentsScreen() {
  useTheme();
  const styles = createStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Документы</Text>
      <Text style={styles.subtitle}>Выберите документ, который хотите открыть.</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          void openExternalUrl(PRIVACY_URL, 'Не удалось открыть Политику конфиденциальности');
        }}
      >
        <Text style={styles.cardTitle}>🔒 Политика конфиденциальности</Text>
        <Text style={styles.cardUrl}>{PRIVACY_URL}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          void openExternalUrl(TERMS_URL, 'Не удалось открыть Пользовательское соглашение');
        }}
      >
        <Text style={styles.cardTitle}>📄 Пользовательское соглашение</Text>
        <Text style={styles.cardUrl}>{TERMS_URL}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.darkGray,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.gray,
      marginBottom: 16,
    },
    card: {
      backgroundColor: Colors.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.darkGray,
      marginBottom: 6,
    },
    cardUrl: {
      fontSize: 13,
      color: Colors.primary,
    },
  });
