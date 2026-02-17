import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Holiday, loadHolidays } from '@/services/holidays';

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHolidays(); }} tintColor={Colors.primary} />}
    >
      <Text style={styles.title}>Праздники РФ</Text>
      <Text style={styles.subtitle}>В эти даты применяется двойная ставка к смене.</Text>

      <View style={styles.card}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {holidays.length === 0 ? (
          <Text style={styles.emptyText}>Праздники пока не добавлены в базе данных.</Text>
        ) : (
          holidays.map((holiday) => (
            <View key={holiday.date} style={styles.row}>
              <Text style={styles.dateText}>{format(parseISO(holiday.date), 'd MMMM yyyy', { locale: ru })}</Text>
              <Text style={styles.nameText}>{holiday.name}</Text>
            </View>
          ))
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
    padding: 20,
    paddingBottom: 32,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.darkGray,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.gray,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 3,
  },
  dateText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  nameText: {
    fontSize: 15,
    color: Colors.darkGray,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    marginBottom: 10,
    fontSize: 14,
  },
});
