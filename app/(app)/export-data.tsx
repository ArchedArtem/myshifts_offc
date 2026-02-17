import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import Colors from '@/constants/Colors';
import { supabase } from '@/services/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

type Period = 'month' | 'year' | 'all';

interface ShiftRow {
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  extra_payment: number;
  earnings: number;
  notes?: string | null;
}

const normalizeTime = (value: string) => value.split(':').slice(0, 2).join(':');

export default function ExportDataScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const periodLabel = useMemo(() => {
    if (period === 'month') return 'Текущий месяц';
    if (period === 'year') return 'Последние 12 месяцев';
    return 'Все время';
  }, [period]);

  const fetchShifts = useCallback(async (): Promise<ShiftRow[]> => {
    if (!user) return [];

    let query = supabase
      .from('shifts')
      .select('date,start_time,end_time,hourly_rate,extra_payment,earnings,notes')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    const now = new Date();
    if (period === 'month') {
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      query = query.gte('date', start).lte('date', end);
    } else if (period === 'year') {
      const start = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      query = query.gte('date', start).lte('date', end);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as ShiftRow[];
  }, [period, user]);

  const buildPrettyExportText = (rows: ShiftRow[]) => {
    const total = rows.reduce((sum, row) => sum + (row.earnings ?? 0), 0);
    const header = [
      '📊 MyShifts — Экспорт смен',
      `Период: ${periodLabel}`,
      `Дата экспорта: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
      `Количество смен: ${rows.length}`,
      `Общий заработок: ${total.toFixed(2)} ₽`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
    ];

    const shiftsBlock = rows.flatMap((row, index) => [
      `#${index + 1} • ${row.date}`,
      `Время: ${normalizeTime(row.start_time)} — ${normalizeTime(row.end_time)}`,
      `Ставка: ${row.hourly_rate ?? 0} ₽/ч`,
      `Доплата: ${row.extra_payment ?? 0} ₽`,
      `Заработок: ${(row.earnings ?? 0).toFixed(2)} ₽`,
      `Комментарий: ${row.notes?.trim() ? row.notes : '—'}`,
      '━━━━━━━━━━━━━━━━━━━━',
    ]);

    return [...header, ...shiftsBlock].join('\n');
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const rows = await fetchShifts();
      setLastCount(rows.length);

      if (!rows.length) {
        Alert.alert('Нет данных', 'За выбранный период смен не найдено.');
        return;
      }

      const prettyText = buildPrettyExportText(rows);
      await Share.share({
        title: 'Экспорт смен MyShifts',
        message: prettyText,
      });
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось экспортировать данные');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Экспорт данных</Text>
      <Text style={styles.subtitle}>Экспортируйте смены в красиво оформленный текст и отправьте через меню «Поделиться».</Text>

      <View style={styles.periodRow}>
        {(['month', 'year', 'all'] as const).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.periodButton, period === item && styles.periodButtonActive]}
            onPress={() => setPeriod(item)}
            disabled={loading}
          >
            <Text style={[styles.periodText, period === item && styles.periodTextActive]}>
              {item === 'month' ? 'Месяц' : item === 'year' ? 'Год' : 'Все'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Выбранный период</Text>
        <Text style={styles.cardText}>{periodLabel}</Text>
        {lastCount !== null && <Text style={styles.cardText}>Последний экспорт: {lastCount} смен</Text>}
      </View>

      <TouchableOpacity style={[styles.exportButton, loading && styles.disabled]} onPress={handleExport} disabled={loading}>
        {loading ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.exportButtonText}>Экспортировать текст</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray, marginBottom: 16 },
  periodRow: { flexDirection: 'row', marginBottom: 16 },
  periodButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: Colors.white,
  },
  periodButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.lightPrimary },
  periodText: { color: Colors.gray, fontSize: 14 },
  periodTextActive: { color: Colors.primary, fontWeight: '600' },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.darkGray, marginBottom: 8 },
  cardText: { fontSize: 14, color: Colors.gray },
  exportButton: { backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', padding: 14 },
  exportButtonText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.7 },
});
