import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase/client';
import * as Haptics from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';

const ADMIN_EMAIL = 'archedartem@gmail.com';

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

    const { data: exactRows, error: exactError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .ilike('email', normalizedEmail)
        .limit(1);

    if (!exactError && exactRows && exactRows.length > 0) {
      return exactRows[0] as ProfileOption;
    }

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', targetMode === 'all' ? 'Уведомление отправлено всем' : 'Уведомление отправлено пользователю');

      setTitle('');
      setBody('');
      setEmailQuery('');
      setSelectedUser(null);
      setSearchResults([]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ошибка', error?.message || 'Не удалось создать уведомление');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.border} />
          <Text style={styles.deniedTitle}>Доступ запрещен</Text>
          <Text style={styles.deniedText}>Эта страница доступна только администратору.</Text>
        </View>
    );
  }

  return (
      <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Админ-панель</Text>
            <Text style={styles.subtitle}>Рассылка внутренних уведомлений для пользователей.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Кому отправить</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                  style={[styles.segmentButton, targetMode === 'all' && styles.segmentButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTargetMode('all');
                    setSelectedUser(null);
                    setEmailQuery('');
                    setSearchResults([]);
                  }}
                  activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, targetMode === 'all' && styles.segmentTextActive]}>Всем</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={[styles.segmentButton, targetMode === 'single' && styles.segmentButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTargetMode('single');
                  }}
                  activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, targetMode === 'single' && styles.segmentTextActive]}>По email</Text>
              </TouchableOpacity>
            </View>

            {targetMode === 'single' && (
                <View style={styles.singleUserSection}>
                  <Text style={styles.label}>Поиск пользователя</Text>
                  <TextInput
                      style={styles.input}
                      value={emailQuery}
                      onChangeText={(value) => { void handleEmailChange(value); }}
                      placeholder="Введите email или имя..."
                      placeholderTextColor={Colors.gray}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                  />

                  {selectedUser && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                        <Text style={styles.selectedHint}>
                          Выбран: {selectedUser.email}
                        </Text>
                      </View>
                  )}

                  {searching ? (
                      <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
                  ) : searchResults.length > 0 ? (
                      <View style={styles.resultsContainer}>
                        {searchResults.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.resultRow}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedUser(item);
                                  setEmailQuery(item.email);
                                  setSearchResults([]);
                                }}
                            >
                              <View>
                                <Text style={styles.resultEmail}>{item.email}</Text>
                                <Text style={styles.resultName}>{item.full_name?.trim() || 'Без имени'}</Text>
                              </View>
                              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        ))}
                      </View>
                  ) : null}
                </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Заголовок</Text>
            <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Например: Технические работы"
                placeholderTextColor={Colors.gray}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Текст сообщения</Text>
            <TextInput
                style={[styles.input, styles.textarea]}
                value={body}
                onChangeText={setBody}
                placeholder="Введите содержание..."
                placeholderTextColor={Colors.gray}
                multiline
                numberOfLines={5}
            />
          </View>

          <TouchableOpacity
              style={[styles.saveButton, (saving || !title || !body) && styles.disabled]}
              onPress={handleCreate}
              disabled={saving || !title || !body}
              activeOpacity={0.8}
          >
            {saving ? (
                <ActivityIndicator color={Colors.onPrimary} />
            ) : (
                <>
                  <Ionicons name="send-outline" size={18} color={Colors.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.saveText}>Отправить уведомление</Text>
                </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.lightGray,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top'
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
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
    fontWeight: '600'
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '800'
  },
  singleUserSection: {
    marginTop: 20,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: Colors.lightPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  selectedHint: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  resultsContainer: {
    marginTop: 12,
    backgroundColor: Colors.lightGray,
    borderRadius: 14,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultEmail: {
    fontSize: 14,
    color: Colors.darkGray,
    fontWeight: '600'
  },
  resultName: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.gray
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 16
  },
  disabled: {
    backgroundColor: Colors.gray,
    shadowOpacity: 0,
    elevation: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 40
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.darkGray,
    marginTop: 20,
  },
  deniedText: {
    fontSize: 15,
    color: Colors.gray,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
});