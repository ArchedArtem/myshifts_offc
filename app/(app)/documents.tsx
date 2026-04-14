import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import Colors from '@/constants/Colors';

export default function DocumentsScreen() {
  useTheme();
  const router = useRouter();
  const styles = createStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Документы</Text>
      <Text style={styles.subtitle}>Выберите документ, который хотите открыть.</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          router.push('/legal?doc=privacy');
        }}
      >
        <Text style={styles.cardTitle}>🔒 Политика конфиденциальности</Text>
        <Text style={styles.cardUrl}>Открыть в приложении</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          router.push('/legal?doc=terms');
        }}
      >
        <Text style={styles.cardTitle}>📄 Пользовательское соглашение</Text>
        <Text style={styles.cardUrl}>Открыть в приложении</Text>
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
