import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useShiftSyncStatus } from '@/hooks/useShiftSyncStatus';
import { syncNow } from '@/services/offlineSync';

type ShiftSyncBannerProps = {
  userId?: string | null;
};

export default function ShiftSyncBanner({ userId }: ShiftSyncBannerProps) {
  const syncState = useShiftSyncStatus();

  const appearance = useMemo(() => {
    if (syncState.status === 'error') {
      return {
        container: styles.errorContainer,
        title: 'Ошибка синхронизации',
        subtitle: syncState.lastError || 'Одно из изменений не удалось отправить в базу. Попробуйте синхронизацию снова.',
        titleColor: Colors.error,
        subtitleColor: Colors.darkGray,
        buttonStyle: styles.errorButton,
      };
    }

    if (syncState.pendingCount > 0 || syncState.status === 'unsynced') {
      return {
        container: styles.pendingContainer,
        title: 'Не синхронизировано',
        subtitle:
          syncState.pendingCount > 0
            ? `В очереди ${syncState.pendingCount} изменений. Они отправятся при появлении интернета или по кнопке ниже.`
            : 'Есть локальные изменения, ожидающие отправки.',
        titleColor: '#92400E',
        subtitleColor: '#78350F',
        buttonStyle: styles.pendingButton,
      };
    }

    return {
      container: styles.syncedContainer,
      title: 'Синхронизировано',
      subtitle: syncState.lastSyncedAt ? 'Все изменения сохранены локально и в облаке.' : 'Данные устройства и базы сейчас совпадают.',
      titleColor: Colors.success,
      subtitleColor: Colors.darkGray,
      buttonStyle: styles.syncedButton,
    };
  }, [syncState.lastError, syncState.lastSyncedAt, syncState.pendingCount, syncState.status]);

  const handleSyncPress = async () => {
    if (!userId || syncState.syncing) return;
    await syncNow(userId, { forceRefreshCache: true });
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, appearance.container]}>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: appearance.titleColor }]}>{appearance.title}</Text>
          <Text style={[styles.subtitle, { color: appearance.subtitleColor }]}>{appearance.subtitle}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, appearance.buttonStyle, syncState.syncing && styles.buttonDisabled]}
          onPress={handleSyncPress}
          disabled={!userId || syncState.syncing}
        >
          {syncState.syncing ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.buttonText}>Синхронизировать сейчас</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  container: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  syncedContainer: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  pendingContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  errorContainer: {
    backgroundColor: Colors.lightError,
    borderColor: Colors.error,
  },
  textWrap: {
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  button: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  syncedButton: {
    backgroundColor: Colors.primary,
  },
  pendingButton: {
    backgroundColor: '#D97706',
  },
  errorButton: {
    backgroundColor: Colors.error,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
