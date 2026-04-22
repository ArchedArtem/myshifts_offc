import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import * as Haptics from '@/utils/haptics';

export default function WidgetsScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();
  const [syncing, setSyncing] = useState(false);

  const handleForceSync = async () => {
    if (!user) return;

    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await syncNextShiftWidgetForUser(user.id);
    } catch (error) {
      console.error('Ошибка синхронизации виджета:', error);
    } finally {
      setTimeout(() => setSyncing(false), 1000);
    }
  };

  return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.promoHeader}>
          <Text style={styles.promoIcon}>🧩</Text>
          <Text style={styles.title}>Виджет на главный экран</Text>
          <Text style={styles.subtitle}>
            Узнавайте о ближайшей смене и следите за доходом, даже не открывая приложение!
          </Text>
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.cardTitle}>Как добавить (Android)</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>Сделайте долгое нажатие на пустом месте рабочего стола вашего телефона.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>В появившемся меню выберите раздел «Виджеты».</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>Найдите «Мои смены», выберите нужный размер и перетащите его на экран.</Text>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Настройки виджета</Text>
          <Text style={styles.infoText}>
            Виджет обновляется автоматически в фоновом режиме. Если данные на рабочем столе зависли или не совпадают с приложением, вы можете обновить их вручную.
          </Text>

          <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonActive]}
              onPress={handleForceSync}
              disabled={syncing}
              activeOpacity={0.8}
          >
            <Text style={styles.syncButtonText}>
              {syncing ? 'Обновление...' : 'Принудительно обновить виджет'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },

  promoHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  promoIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },

  instructionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 16,
  },

  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    fontSize: 15,
    color: Colors.darkGray,
    lineHeight: 22,
    flex: 1,
  },

  infoText: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 20,
  },

  syncButton: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  syncButtonActive: {
    backgroundColor: Colors.lightPrimary,
  },
  syncButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});