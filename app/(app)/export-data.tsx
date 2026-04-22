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
  Platform,
} from 'react-native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import * as Haptics from '@/utils/haptics';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { getAllShiftsOfflineAware } from '@/services/offlineShifts';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

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
    return 'За всё время';
  }, [period]);

  const fetchShifts = useCallback(async (): Promise<ShiftRow[]> => {
    if (!user) return [];

    const now = new Date();
    const { shifts } = await getAllShiftsOfflineAware(user.id);
    let rows = (shifts ?? []) as ShiftRow[];

    if (period === 'month') {
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      rows = rows.filter((row) => row.date >= start && row.date <= end);
    } else if (period === 'year') {
      const start = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      rows = rows.filter((row) => row.date >= start && row.date <= end);
    }

    return rows
        .slice()
        .sort((a, b) => `${a.date} ${normalizeTime(a.start_time)}`.localeCompare(`${b.date} ${normalizeTime(b.start_time)}`));
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      const rows = await fetchShifts();
      setLastCount(rows.length);

      if (!rows.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Нет данных', 'За выбранный период смен не найдено.');
        return;
      }

      const prettyText = buildPrettyExportText(rows);
      await Share.share({
        title: 'Экспорт смен MyShifts',
        message: prettyText,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', error.message || 'Не удалось экспортировать данные');
    } finally {
      setLoading(false);
    }
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Экспорт данных</Text>
          <Text style={styles.subtitle}>
            Сохраните свои смены в виде красиво оформленного текста и отправьте куда угодно через системное меню «Поделиться».
          </Text>
        </View>

        <View style={styles.periodControlWrap}>
          <View style={styles.segmentedControl}>
            {(['month', 'year', 'all'] as const).map((item) => (
                <TouchableOpacity
                    key={item}
                    style={[styles.segmentButton, period === item && styles.segmentButtonActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPeriod(item);
                    }}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, period === item && styles.segmentTextActive]}>
                    {item === 'month' ? 'Месяц' : item === 'year' ? 'Год' : 'Всё время'}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="document-text-outline" size={28} color={Colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Выбранный период</Text>
            <Text style={styles.cardText}>{periodLabel}</Text>
            {lastCount !== null && (
                <Text style={styles.cardSubText}>Последний экспорт: {lastCount} смен</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
            style={[styles.exportButton, loading && styles.disabled]}
            onPress={handleExport}
            disabled={loading}
            activeOpacity={0.8}
        >
          {loading ? (
              <ActivityIndicator color={Colors.onPrimary} />
          ) : (
              <>
                <Ionicons name="share-outline" size={20} color={Colors.onPrimary} style={styles.exportIcon} />
                <Text style={styles.exportButtonText}>Сгенерировать текст</Text>
              </>
          )}
        </TouchableOpacity>
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
    lineHeight: 20
  },
  periodControlWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    color: Colors.gray,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lightPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray,
    marginBottom: 4
  },
  cardText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGray
  },
  cardSubText: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  exportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportIcon: {
    marginRight: 8,
  },
  exportButtonText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 16
  },
  disabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
});