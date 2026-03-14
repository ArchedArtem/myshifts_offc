import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { sendAdminPush } from '@/services/pushNotifications';

const ADMIN_EMAIL = 'archedartem@gmail.com'; // поменять здесь при необходимости

export default function AdminPushScreen() {
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(() => (user?.email || '').toLowerCase() === ADMIN_EMAIL, [user?.email]);

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

      const result = await sendAdminPush({
        title: normalizedTitle,
        body: normalizedBody,
        mode: 'all',
        createdByUserId: user.id,
      });

      Alert.alert('Готово', `Push отправлены всем. Доставлено на ${result.sentCount} устройство(а).`);
      setTitle('');
      setBody('');
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
      <Text style={styles.title}>Админ push</Text>
      <Text style={styles.subtitle}>Короткий режим: отправка только всем пользователям.</Text>

      <View style={styles.card}>
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
          <Text style={styles.saveText}>{saving ? 'Отправка...' : 'Отправить всем'}</Text>
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
    saveButton: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', padding: 14 },
    saveText: { color: Colors.onPrimary, fontWeight: '600', fontSize: 16 },
    disabled: { opacity: 0.7 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 20 },
    deniedTitle: { fontSize: 20, fontWeight: '700', color: Colors.darkGray },
    deniedText: { fontSize: 14, color: Colors.gray, marginTop: 8, textAlign: 'center' },
  });
