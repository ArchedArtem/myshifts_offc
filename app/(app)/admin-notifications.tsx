import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';

const ADMIN_EMAIL = 'archedartem@gmail.com'; // поменять здесь при необходимости

type TargetMode = 'all' | 'single';

type ProfileOption = {
  id: string;
  email: string;
  full_name: string | null;
};

export default function AdminNotificationsScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ProfileOption | null>(null);
  const [searchResults, setSearchResults] = useState<ProfileOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(() => (user?.email || '').toLowerCase() === ADMIN_EMAIL, [user?.email]);

  const searchProfiles = useCallback(async (rawQuery: string) => {
    const normalized = rawQuery.trim();
    if (!normalized) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .ilike('email', `%${normalized}%`)
        .order('email', { ascending: true })
        .limit(20);

      if (error) throw error;
      setSearchResults((data || []) as ProfileOption[]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleEmailChange = async (value: string) => {
    setEmailQuery(value);

    if (selectedUser && selectedUser.email.toLowerCase() !== value.trim().toLowerCase()) {
      setSelectedUser(null);
    }

    await searchProfiles(value);
  };

  const resolveTargetUser = async (): Promise<ProfileOption | null> => {
    if (selectedUser) return selectedUser;

    const normalizedEmail = emailQuery.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      Alert.alert('Ошибка', 'Введите корректный email получателя');
      return null;
    }

    // 1) Пробуем точное совпадение без учета регистра
    const { data: exactRows, error: exactError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', normalizedEmail)
      .limit(1);

    if (!exactError && exactRows && exactRows.length > 0) {
      return exactRows[0] as ProfileOption;
    }

    // 2) Фолбэк: убираем пробелы и ищем в подстроке (на случай грязных данных)
    const { data: fuzzyRows, error: fuzzyError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', `%${normalizedEmail}%`)
      .limit(1);

    if (!fuzzyError && fuzzyRows && fuzzyRows.length > 0) {
      return fuzzyRows[0] as ProfileOption;
    }

    Alert.alert('Ошибка', 'Пользователь с таким email не найден');
    return null;
  };

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
        const targetUser = await resolveTargetUser();
        if (!targetUser) return;

        targetUserId = targetUser.id;
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
      setEmailQuery('');
      setSelectedUser(null);
      setSearchResults([]);
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
            onPress={() => {
              setTargetMode('all');
              setSelectedUser(null);
              setEmailQuery('');
              setSearchResults([]);
            }}
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
            <Text style={styles.label}>Email получателя (поиск + выбор)</Text>
            <TextInput
              style={styles.input}
              value={emailQuery}
              onChangeText={(value) => { void handleEmailChange(value); }}
              placeholder="Начните вводить email"
              placeholderTextColor={Colors.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {selectedUser && (
              <Text style={styles.selectedHint}>
                Выбран: {selectedUser.full_name?.trim() ? `${selectedUser.full_name} · ` : ''}{selectedUser.email}
              </Text>
            )}

            {searching ? (
              <Text style={styles.searchHint}>Поиск пользователей...</Text>
            ) : searchResults.length > 0 ? (
              <View style={styles.resultsCard}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.resultRow}
                    onPress={() => {
                      setSelectedUser(item);
                      setEmailQuery(item.email);
                      setSearchResults([]);
                    }}
                  >
                    <Text style={styles.resultEmail}>{item.email}</Text>
                    <Text style={styles.resultName}>{item.full_name?.trim() || 'Без имени'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : emailQuery.trim() ? (
              <Text style={styles.searchHint}>Совпадений не найдено, можно отправить по точному email.</Text>
            ) : null}
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
  selectedHint: { marginTop: 8, fontSize: 12, color: Colors.primary, fontWeight: '600' },
  searchHint: { marginTop: 8, fontSize: 12, color: Colors.gray },
  resultsCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  resultEmail: { fontSize: 14, color: Colors.darkGray, fontWeight: '600' },
  resultName: { marginTop: 2, fontSize: 12, color: Colors.gray },
  saveButton: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', padding: 14 },
  saveText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.7 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 20 },
  deniedTitle: { fontSize: 20, fontWeight: '700', color: Colors.darkGray },
  deniedText: { fontSize: 14, color: Colors.gray, marginTop: 8, textAlign: 'center' },
});
