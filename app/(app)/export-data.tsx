import React, { useCallback, useMemo, useState, useEffect } from 'react';
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
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

type Period = 'month' | 'year' | 'all';
type ExportFormat = 'pdf' | 'csv' | 'txt';

interface ShiftRow {
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  extra_payment: number;
  earnings: number;
  notes?: string | null;
}

interface PeriodStats {
  totalEarnings: number;
  totalShifts: number;
  avgHourlyRate: number;
}

const normalizeTime = (value: string) => value.split(':').slice(0, 2).join(':');

export default function ExportDataScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [previewStats, setPreviewStats] = useState<PeriodStats | null>(null);
  const [cachedRows, setCachedRows] = useState<ShiftRow[]>([]);

  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const periodLabel = useMemo(() => {
    if (period === 'month') return 'Текущий месяц';
    if (period === 'year') return 'Последние 12 месяцев';
    return 'За всё время';
  }, [period]);

  const formatConfig = useMemo(() => {
    switch (exportFormat) {
      case 'pdf':
        return { label: 'Сгенерировать PDF отчет', color: Colors.primary, icon: 'document-text-outline' as const };
      case 'csv':
        return { label: 'Выгрузить таблицу .CSV', color: Colors.primary, icon: 'grid-outline' as const };
      case 'txt':
        return { label: 'Скопировать как текст', color: Colors.primary, icon: 'copy-outline' as const };
    }
  }, [exportFormat]);

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

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const rows = await fetchShifts();
        if (!isMounted) return;

        setCachedRows(rows);
        if (rows.length > 0) {
          const total = rows.reduce((sum, row) => sum + (row.earnings ?? 0), 0);
          const totalRate = rows.reduce((sum, row) => sum + (row.hourly_rate ?? 0), 0);
          setPreviewStats({
            totalEarnings: total,
            totalShifts: rows.length,
            avgHourlyRate: Math.round(totalRate / rows.length),
          });
        } else {
          setPreviewStats(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    }
    loadStats();
    return () => { isMounted = false; };
  }, [period, fetchShifts]);

  // ШАБЛОН ДЛЯ PDF КРАСИВОЙ ТАБЛИЦЫ СМЕН
  const buildHtmlContent = (rows: ShiftRow[], stats: PeriodStats) => {
    const formattedDate = format(new Date(), 'dd.MM.yyyy HH:mm');
    const tableRowsHtml = rows.map((r, i) => `
      <tr>
        <td style="text-align: center;">${i + 1}</td>
        <td>${format(new Date(r.date), 'dd.MM.yyyy')}</td>
        <td style="text-align: center;">${normalizeTime(r.start_time)} — ${normalizeTime(r.end_time)}</td>
        <td style="text-align: right;">${r.hourly_rate} ₽</td>
        <td style="text-align: right;">${r.extra_payment} ₽</td>
        <td style="text-align: right; font-weight: bold; color: #4F46E5;">${r.earnings.toFixed(2)} ₽</td>
        <td style="color: #6B7280; font-size: 11px;">${r.notes || '—'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Отчет по сменам - Мои смены</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 30px; margin: 0; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F3F4F6; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 24px; font-weight: 800; color: #4F46E5; letter-spacing: -0.5px; }
          .meta { font-size: 12px; color: #6B7280; text-align: right; line-height: 1.5; }
          .title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 24px; }
          .stats-grid { display: flex; gap: 15px; margin-bottom: 30px; }
          .stat-card { flex: 1; padding: 16px; background: #F9FAFB; border-radius: 12px; border: 1px solid #E5E7EB; }
          .stat-label { font-size: 11px; color: #6B7280; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
          .stat-value { font-size: 20px; font-weight: 800; color: #111827; }
          .primary-value { color: #4F46E5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #F9FAFB; color: #4B5563; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 12px 10px; border-bottom: 2px solid #E5E7EB; text-align: left; }
          td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #E5E7EB; color: #374151; word-break: break-word; }
          tr:nth-child(even) { background: #FCFCFD; }
          .footer { text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 60px; border-top: 1px dashed #E5E7EB; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Мои смены</div>
          <div class="meta">
            <div><strong>Период:</strong> ${periodLabel}</div>
            <div><strong>Сгенерировано:</strong> ${formattedDate}</div>
          </div>
        </div>
        <div class="title">Финансовый отчет по рабочим сменам</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Общий заработок</div>
            <div class="primary-value stat-value">${stats.totalEarnings.toLocaleString('ru-RU')} ₽</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Всего рабочих смен</div>
            <div class="stat-value">${stats.totalShifts}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Средняя ставка</div>
            <div class="stat-value">${stats.avgHourlyRate} ₽/ч</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">№</th>
              <th style="width: 15%;">Дата</th>
              <th style="width: 20%; text-align: center;">Время работы</th>
              <th style="width: 13%; text-align: right;">Ставка</th>
              <th style="width: 12%; text-align: right;">Доплаты</th>
              <th style="width: 15%; text-align: right;">Итого</th>
              <th style="width: 20%;">Комментарий</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
        <div class="footer">Документ сгенерирован автоматически в системе учета Мои Смены.</div>
      </body>
      </html>
    `;
  };

  const buildPrettyExportText = (rows: ShiftRow[]) => {
    const total = rows.reduce((sum, row) => sum + (row.earnings ?? 0), 0);
    const header = [
      '📊 Мои смены — Экспорт смен',
      `Период: ${periodLabel}`,
      `Дата выгрузки: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
      `Всего смен: ${rows.length}`,
      `Общий заработок: ${total.toLocaleString('ru-RU')} ₽`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
    ];

    const shiftsBlock = rows.flatMap((row, index) => [
      `#${index + 1} • ${format(new Date(row.date), 'dd.MM.yyyy')}`,
      `Время: ${normalizeTime(row.start_time)} — ${normalizeTime(row.end_time)}`,
      `Ставка: ${row.hourly_rate} ₽/ч | Доплата: ${row.extra_payment} ₽`,
      `Итоговый заработок: ${row.earnings.toFixed(2)} ₽`,
      `Комментарий: ${row.notes?.trim() ? row.notes : '—'}`,
      '━━━━━━━━━━━━━━━━━━━━',
    ]);

    return [...header, ...shiftsBlock].join('\n');
  };

  const buildCsvContent = (rows: ShiftRow[]) => {
    const headers = 'Дата;Начало;Конец;Ставка (руб/ч);Доплата (руб);Заработок (руб);Комментарий\n';
    const body = rows.map((r) => {
      const cleanNote = (r.notes ?? '').replace(/[\n\r;]+/g, ' ').replace(/"/g, '""');
      return `${format(new Date(r.date), 'dd.MM.yyyy')};${normalizeTime(r.start_time)};${normalizeTime(r.end_time)};${r.hourly_rate};${r.extra_payment};${r.earnings};"${cleanNote}"`;
    }).join('\n');
    return '\ufeff' + headers + body;
  };

  // МЕТОДЫ ЭКСПОРТА С КОРРЕКТНЫМИ WEB-ФОЛБЕКАМИ
  const handleTextExport = async () => {
    try {
      const prettyText = buildPrettyExportText(cachedRows);

      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(prettyText);
          Alert.alert('Скопировано!', 'Данные смен скопированы в буфер обмена.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert('Ошибка', 'Буфер обмена недоступен в вашем браузере');
        }
        return;
      }

      await Share.share({ title: 'Экспорт смен Мои смены', message: prettyText });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) { showError(error); }
  };

  const handleCsvExport = async () => {
    try {
      const csvContent = buildCsvContent(cachedRows);
      const fileName = `MyShifts_${period}_${format(new Date(), 'yyyyMMdd')}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const docDirectory = (FileSystem as any).documentDirectory;
      const fileUri = `${docDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' as any });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Сохранить CSV таблицу' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) { showError(error); }
  };

  const handlePdfExport = async () => {
    if (!previewStats) return;
    try {
      const htmlHtml = buildHtmlContent(cachedRows, previewStats);

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlHtml);
          printWindow.document.close();
          printWindow.focus();
          // Небольшой таймаут, чтобы стили и шрифты успели отрендериться перед открытием диалога печати
          setTimeout(() => {
            printWindow.print();
          }, 300);
        }
        return;
      }

      const { uri } = await Print.printToFileAsync({ html: htmlHtml });
      const docDirectory = (FileSystem as any).documentDirectory;
      const customName = `${docDirectory}MyShifts_Report_${format(new Date(), 'yyyyMMdd')}.pdf`;

      await FileSystem.moveAsync({ from: uri, to: customName });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(customName, { mimeType: 'application/pdf', dialogTitle: 'Ваш PDF Отчет' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) { showError(error); }
  };

  const handleMainExport = async () => {
    if (!cachedRows.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Нет данных', 'За выбранный период смен не найдено.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    if (exportFormat === 'pdf') await handlePdfExport();
    else if (exportFormat === 'csv') await handleCsvExport();
    else if (exportFormat === 'txt') await handleTextExport();

    setLoading(false);
  };

  const showError = (error: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Ошибка', error.message || 'Не удалось выполнить экспорт');
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Экспорт данных</Text>
          <Text style={styles.subtitle}>
            Выбирайте нужный период времени, оценивайте финансовую сводку и сохраняйте отчет в любом удобном формате.
          </Text>
        </View>

        {/* Выбор периода */}
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

        {/* Сводка live статистики */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Сводка за {periodLabel.toLowerCase()}</Text>
          {statsLoading ? (
              <View style={styles.statsLoader}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={styles.loaderText}>Считаю данные...</Text>
              </View>
          ) : previewStats ? (
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: Colors.lightPrimary }]}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  <Text style={styles.statValue}>{previewStats.totalEarnings.toLocaleString('ru-RU')} ₽</Text>
                  <Text style={styles.statLabel}>Заработок</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.lightPrimary }]}>
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.statValue, { color: Colors.primary }]}>{previewStats.totalShifts}</Text>
                  <Text style={styles.statLabel}>Всего смен</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.lightPrimary }]}>
                  <Ionicons name="speedometer-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.statValue, { color: Colors.primary }]}>{previewStats.avgHourlyRate} ₽</Text>
                  <Text style={styles.statLabel}>Ср. ставка</Text>
                </View>
              </View>
          ) : (
              <View style={styles.emptyStatsCard}>
                <Ionicons name="folder-open-outline" size={24} color={Colors.gray} />
                <Text style={styles.emptyStatsText}>Нет сохраненных смен за этот период</Text>
              </View>
          )}
        </View>

        {/* Выбор формата (Интерактивные карточки) */}
        <View style={styles.formatSection}>
          <Text style={styles.sectionTitle}>Выберите формат экспорта</Text>

          <TouchableOpacity
              style={[styles.formatCard, exportFormat === 'pdf' && styles.formatCardActivePdf]}
              onPress={() => setExportFormat('pdf')}
              activeOpacity={0.9}
          >
            <View style={[styles.formatIconCircle, { backgroundColor: Colors.lightPrimary }]}>
              <Ionicons name="document-text" size={24} color={Colors.primary} />
            </View>
            <View style={styles.formatInfo}>
              <Text style={styles.formatTitle}>Официальный PDF документ</Text>
              <Text style={styles.formatDesc}>Чистый печатный отчет со сводными таблицами заработка</Text>
            </View>
            <View style={[styles.radioCircle, exportFormat === 'pdf' && { borderColor: Colors.primary }]}>
              {exportFormat === 'pdf' && <View style={[styles.radioDot, { backgroundColor: Colors.primary }]} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
              style={[styles.formatCard, exportFormat === 'csv' && styles.formatCardActiveCsv]}
              onPress={() => setExportFormat('csv')}
              activeOpacity={0.9}
          >
            <View style={[styles.formatIconCircle, { backgroundColor: Colors.lightPrimary }]}>
              <Ionicons name="grid" size={24} color={Colors.primary} />
            </View>
            <View style={styles.formatInfo}>
              <Text style={styles.formatTitle}>Таблица Excel / CSV файл</Text>
              <Text style={styles.formatDesc}>Для импорта и детального анализа в электронных таблицах</Text>
            </View>
            <View style={[styles.radioCircle, exportFormat === 'csv' && { borderColor: Colors.primary }]}>
              {exportFormat === 'csv' && <View style={[styles.radioDot, { backgroundColor: Colors.primary }]} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
              style={[styles.formatCard, exportFormat === 'txt' && styles.formatCardActiveTxt]}
              onPress={() => setExportFormat('txt')}
              activeOpacity={0.9}
          >
            <View style={[styles.formatIconCircle, { backgroundColor: Colors.lightPrimary }]}>
              <Ionicons name="copy" size={24} color={Colors.primary} />
            </View>
            <View style={styles.formatInfo}>
              <Text style={styles.formatTitle}>Скопировать обычным текстом</Text>
              <Text style={styles.formatDesc}>Удобно для быстрой отправки текстового списка в мессенджеры</Text>
            </View>
            <View style={[styles.radioCircle, exportFormat === 'txt' && { borderColor: Colors.primary }]}>
              {exportFormat === 'txt' && <View style={[styles.radioDot, { backgroundColor: Colors.primary }]} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Единая умная кнопка действия */}
        <TouchableOpacity
            style={[styles.mainExportButton, { backgroundColor: formatConfig.color }, (loading || statsLoading) && styles.disabled]}
            onPress={handleMainExport}
            disabled={loading || statsLoading}
            activeOpacity={0.8}
        >
          {loading ? (
              <ActivityIndicator color="#FFF" />
          ) : (
              <>
                <Ionicons name={formatConfig.icon} size={22} color="#FFF" style={styles.exportIcon} />
                <Text style={styles.mainExportButtonText}>{formatConfig.label}</Text>
              </>
          )}
        </TouchableOpacity>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray, lineHeight: 20 },
  periodControlWrap: { paddingHorizontal: 16, marginBottom: 24 },
  segmentedControl: { flexDirection: 'row', backgroundColor: Colors.lightGray, borderRadius: 14, padding: 4 },
  segmentButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  segmentButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentText: { fontSize: 13, color: Colors.gray, fontWeight: '600' },
  segmentTextActive: { color: Colors.primary, fontWeight: '800' },
  statsContainer: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, borderRadius: 20, padding: 30, gap: 10 },
  loaderText: { color: Colors.gray, fontSize: 14, fontWeight: '500' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginTop: 8, marginBottom: 2, textAlign: 'center' },
  statLabel: { fontSize: 11, color: Colors.gray, fontWeight: '600', textAlign: 'center' },
  emptyStatsCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, borderRadius: 20, padding: 32, gap: 8, borderWidth: 1, borderColor: Colors.lightGray, borderStyle: 'dashed' },
  emptyStatsText: { color: Colors.gray, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  formatSection: { paddingHorizontal: 16, marginBottom: 30, gap: 10 },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  formatCardActivePdf: { borderColor: Colors.primary, backgroundColor: Colors.lightPrimary },
  formatCardActiveCsv: { borderColor: Colors.primary, backgroundColor: Colors.lightPrimary },
  formatCardActiveTxt: { borderColor: Colors.primary, backgroundColor: Colors.lightPrimary },
  formatIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  formatInfo: { flex: 1, paddingRight: 8 },
  formatTitle: { fontSize: 15, fontWeight: '700', color: Colors.darkGray, marginBottom: 2 },
  formatDesc: { fontSize: 12, color: Colors.gray, lineHeight: 16 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.lightGray, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  mainExportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  exportIcon: { marginRight: 8 },
  mainExportButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
});