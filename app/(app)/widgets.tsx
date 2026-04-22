import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator
} from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';
import * as Haptics from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Ошибка синхронизации виджета:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTimeout(() => setSyncing(false), 1000);
    }
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="apps-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Виджеты</Text>
          <Text style={styles.subtitle}>
            Следите за графиком и доходами прямо с главного экрана вашего телефона.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Как добавить на экран</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>Удерживайте палец на пустом месте рабочего стола.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>Нажмите кнопку «Виджеты» в появившемся меню.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>Найдите «Мои смены» и перетащите виджет на экран.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="settings-outline" size={20} color={Colors.darkGray} />
            <Text style={styles.cardTitleInline}>Настройки</Text>
          </View>

          <Text style={styles.infoText}>
            Обычно виджет обновляется сам. Если данные на рабочем столе устарели, вы можете обновить их вручную.
          </Text>

          <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonActive]}
              onPress={handleForceSync}
              disabled={syncing}
              activeOpacity={0.8}
          >
            {syncing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.syncButtonText}>Обновить данные виджета</Text>
                </>
            )}
          </TouchableOpacity>
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
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconContainer: {
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
  headerTitle: {
    fontSize: 28,
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
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleInline: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGray,
    marginLeft: 8,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  stepText: {
    fontSize: 15,
    color: Colors.darkGray,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 24,
  },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonActive: {
    backgroundColor: Colors.lightPrimary,
  },
  syncButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 6,
    fontWeight: '500',
  },
});