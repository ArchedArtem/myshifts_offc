import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';

const ADMIN_EMAIL = 'archedartem@gmail.com'; // поменять здесь при необходимости

type TargetMode = 'all' | 'single';

export default function AdminNotificationsScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(() => (user?.email || '').toLowerCase() === ADMIN_EMAIL, [user?.email]);

  const handleCreate = async () => {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();

    if (!normalizedTitle || !normalizedBody) {
      Alert.alert('Ошибка', 'Заполните заголовок и текст уведомления');
      return;
    }

    setSaving(true);
    try {
      if (!isAdmin) {
        Alert.alert('Ошибка', 'Доступ запрещен');
        return;
      }

      let targetUserId: string | null = null;

      if (targetMode === 'single') {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail.includes('@')) {
          Alert.alert('Ошибка', 'Введите корректный email получателя');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .single();

        if (profileError || !profile?.id) {
          Alert.alert('Ошибка', 'Пользователь с таким email не найден');
          return;
        }

        targetUserId = profile.id as string;
      }

      const { error } = await supabase
        .from('announcements')
        .insert([
          {
            title: normalizedTitle,
            body: normalizedBody,
            target_user_id: targetUserId,
            is_active: true,
          },
        ]);

      if (error) throw error;

      Alert.alert('Готово', targetMode === 'all' ? 'Уведомление отправлено всем пользователям' : 'Уведомление отправлено выбранному пользователю');
      setTitle('');
      setBody('');
      setEmail('');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось создать уведомление');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedTitle}>Доступ запрещен</Text>
        <Text style={styles.deniedText}>Эта страница доступна только администратору.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Админ-панель уведомлений</Text>
      <Text style={styles.subtitle}>Создавайте сообщения для всех или для конкретного пользователя.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Кому отправить</Text>
        <View style={styles.segmentedWrap}>
          <TouchableOpacity
            style={[styles.segmentedButton, targetMode === 'all' && styles.segmentedButtonActive]}
            onPress={() => setTargetMode('all')}
          >
            <Text style={[styles.segmentedText, targetMode === 'all' && styles.segmentedTextActive]}>Всем</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentedButton, targetMode === 'single' && styles.segmentedButtonActive]}
            onPress={() => setTargetMode('single')}
          >
            <Text style={[styles.segmentedText, targetMode === 'single' && styles.segmentedTextActive]}>По email</Text>
          </TouchableOpacity>
        </View>

        {targetMode === 'single' && (
          <>
            <Text style={styles.label}>Email получателя</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="user@mail.com"
              placeholderTextColor={Colors.gray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        )}

        <Text style={styles.label}>Заголовок</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Например: Важное обновление"
          placeholderTextColor={Colors.gray}
        />

        <Text style={styles.label}>Текст</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={body}
          onChangeText={setBody}
          placeholder="Введите текст уведомления"
          placeholderTextColor={Colors.gray}
          multiline
          numberOfLines={5}
        />

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleCreate} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Отправка...' : 'Отправить уведомление'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray },
  subtitle: { marginTop: 6, fontSize: 14, color: Colors.gray },
  card: { marginTop: 14, backgroundColor: Colors.white, borderRadius: 12, padding: 14 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.darkGray, marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    color: Colors.darkGray,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  segmentedWrap: {
    backgroundColor: Colors.lightPrimary,
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    gap: 8,
  },
  segmentedButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentedButtonActive: { backgroundColor: Colors.primary },
  segmentedText: { color: Colors.darkGray, fontWeight: '600' },
  segmentedTextActive: { color: Colors.onPrimary },
  saveButton: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', padding: 14 },
  saveText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.7 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 20 },
  deniedTitle: { fontSize: 20, fontWeight: '700', color: Colors.darkGray },
  deniedText: { fontSize: 14, color: Colors.gray, marginTop: 8, textAlign: 'center' },
});
