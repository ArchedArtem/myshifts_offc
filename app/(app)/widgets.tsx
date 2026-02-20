import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import { calculateDuration, calculateEarnings } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import { syncNextShiftWidgetForUser } from '@/services/androidWidget';

type ShiftRow = {
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  extra_payment: number;
  break?: number | null;
};

const normalizeTime = (time: string) => time?.split(':').slice(0, 2).join(':');

export default function WidgetsScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();
  const [refreshing, setRefreshing] = useState(false);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [nextShift, setNextShift] = useState<string>('Нет ближайшей смены');

  const loadData = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const [{ data: monthData }, { data: weekData }, { data: nextData }] = await Promise.all([
      supabase.from('shifts').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('shifts').select('*').eq('user_id', user.id).gte('date', weekStart).lte('date', weekEnd),
      supabase.from('shifts').select('date, start_time').eq('user_id', user.id).gte('date', format(now, 'yyyy-MM-dd')).order('date', { ascending: true }).order('start_time', { ascending: true }).limit(1),
    ]);

    const monthRows = (monthData || []) as ShiftRow[];
    const weekRows = (weekData || []) as ShiftRow[];

    const earnings = monthRows.reduce((sum, shift) => sum + calculateEarnings(
      normalizeTime(shift.start_time),
      normalizeTime(shift.end_time),
      shift.hourly_rate ?? 0,
      shift.extra_payment ?? 0,
      shift.break ?? 0,
    ), 0);

    const hours = weekRows.reduce((sum, shift) => sum + calculateDuration(
      normalizeTime(shift.start_time),
      normalizeTime(shift.end_time),
      shift.break ?? 0,
    ), 0);

    setMonthEarnings(earnings);
    setWeekHours(hours);

    const nearest = (nextData || [])[0] as { date: string; start_time: string } | undefined;
    if (nearest) {
      const dt = parseISO(`${nearest.date}T${normalizeTime(nearest.start_time)}:00`);
      setNextShift(`${format(dt, 'dd.MM')} в ${normalizeTime(nearest.start_time)}`);
    } else {
      setNextShift('Нет ближайшей смены');
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Виджеты</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Доход за месяц</Text>
        <Text style={styles.cardValue}>{monthEarnings.toFixed(2)} ₽</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱ Часы за неделю</Text>
        <Text style={styles.cardValue}>{weekHours.toFixed(1)} ч</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 Ближайшая смена</Text>
        <Text style={styles.cardValue}>{nextShift}</Text>
      </View>



      <TouchableOpacity style={styles.refreshButton} onPress={async () => { await loadData(); if (user?.id) { await syncNextShiftWidgetForUser(user.id); } }}>
        <Text style={styles.refreshText}>Обновить виджет</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, backgroundColor: Colors.primary },
  title: { fontSize: 24, color: Colors.onPrimary, fontWeight: '700' },
  card: { backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16 },
  cardTitle: { color: Colors.gray, marginBottom: 6 },
  cardValue: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  infoCard: { backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16 },
  infoTitle: { marginTop: 10, color: Colors.darkGray, fontWeight: '700' },
  infoCode: {
    marginTop: 6,
    fontFamily: 'monospace',
    color: Colors.primary,
    backgroundColor: Colors.lightPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoText: { color: Colors.darkGray, lineHeight: 20 },
  refreshButton: { margin: 16, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', padding: 14 },
  refreshText: { color: Colors.onPrimary, fontWeight: '600' },
});
