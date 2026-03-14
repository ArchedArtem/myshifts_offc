import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import {
  findProfileByEmail,
  PushAudienceMode,
  PushTargetUser,
  searchProfilesByEmail,
  sendAdminPush,
} from '@/services/pushNotifications';

const ADMIN_EMAIL = 'archedartem@gmail.com'; // поменять здесь при необходимости

export default function AdminPushScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const [targetMode, setTargetMode] = useState<PushAudienceMode>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<PushTargetUser | null>(null);
  const [searchResults, setSearchResults] = useState<PushTargetUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(() => (user?.email || '').toLowerCase() === ADMIN_EMAIL, [user?.email]);

  const searchProfiles = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!normalized) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const rows = await searchProfilesByEmail(normalized);
      setSearchResults(rows);
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

  const resolveTargetUser = async (): Promise<PushTargetUser | null> => {
    if (selectedUser) return selectedUser;

    const userByEmail = await findProfileByEmail(emailQuery);
    if (!userByEmail) {
      Alert.alert('Ошибка', 'Пользователь с таким email не найден');
      return null;
    }

    return userByEmail;
  };

  const handleSendPush = async () => {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();

    if (!normalizedTitle || !normalizedBody) {
      Alert.alert('Ошибка', 'Заполните заголовок и текст push-уведомления');
      return;
    }

    if (!user?.id) {
      Alert.alert('Ошибка', 'Пользователь не авторизован');
      return;
    }

    setSaving(true);
    try {
      if (!isAdmin) {
        Alert.alert('Ошибка', 'Доступ запрещен');
        return;
      }

      let targetUserId: string | undefined;
      if (targetMode === 'single') {
        const targetUser = await resolveTargetUser();
        if (!targetUser) return;
        targetUserId = targetUser.id;
      }

      const result = await sendAdminPush({
        title: normalizedTitle,
        body: normalizedBody,
        mode: targetMode,
        targetUserId,
        createdByUserId: user.id,
      });

      Alert.alert('Готово', `Push отправлены. Доставлено на ${result.sentCount} устройство(а).`);
      setTitle('');
      setBody('');
      setEmailQuery('');
      setSelectedUser(null);
      setSearchResults([]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось отправить push-уведомление');
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
      <Text style={styles.title}>Админ-панель push</Text>
      <Text style={styles.subtitle}>Отправляйте push-уведомления всем или конкретному пользователю.</Text>

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
              onChangeText={(value) => {
                void handleEmailChange(value);
              }}
              placeholder="Начните вводить email"
              placeholderTextColor={Colors.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {selectedUser && (
              <Text style={styles.selectedHint}>
                Выбран: {selectedUser.full_name?.trim() ? `${selectedUser.full_name} · ` : ''}
                {selectedUser.email}
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

        <Text style={styles.label}>Заголовок push</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Например: Срочное обновление"
          placeholderTextColor={Colors.gray}
        />

        <Text style={styles.label}>Текст push</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={body}
          onChangeText={setBody}
          placeholder="Введите текст push-уведомления"
          placeholderTextColor={Colors.gray}
          multiline
          numberOfLines={5}
        />

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSendPush} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Отправка...' : 'Отправить push'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = () =>
  StyleSheet.create({
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
