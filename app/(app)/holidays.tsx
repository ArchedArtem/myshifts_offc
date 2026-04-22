import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Holiday, loadHolidays } from '@/services/holidays';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/haptics';

export default function HolidaysScreen() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useTheme();
  const styles = createStyles();

  const fetchHolidays = useCallback(async () => {
    try {
      setError('');
      const data = await loadHolidays();
      setHolidays(data);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить праздники');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchHolidays();
  };

  if (loading) {
    return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );
  }

  return (
      <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
            />
          }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Праздники РФ</Text>
          <Text style={styles.subtitle}>
            В эти даты автоматически применяется двойная ставка к вашей смене.
          </Text>
        </View>

        <View style={styles.card}>
          {error ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
          ) : null}

          {!error && holidays.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-clear-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyText}>Праздники пока не добавлены в базу данных.</Text>
              </View>
          ) : (
              holidays.map((holiday, index) => {
                const isLast = index === holidays.length - 1;
                return (
                    <View key={holiday.date} style={[styles.row, isLast && styles.lastRow]}>
                      <View style={styles.iconWrap}>
                        <Ionicons name="star" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.textWrap}>
                        <Text style={styles.dateText}>
                          {format(parseISO(holiday.date), 'd MMMM yyyy', { locale: ru })}
                        </Text>
                        <Text style={styles.nameText}>{holiday.name}</Text>
                      </View>
                    </View>
                );
              })
          )}
        </View>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.lightPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 16,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});