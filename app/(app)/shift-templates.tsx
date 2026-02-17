import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  ShiftTemplate,
  createCustomShiftTemplate,
  deleteCustomShiftTemplate,
  loadCustomShiftTemplates,
} from '@/services/shiftTemplates';

const emptyForm = {
  name: '',
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: '30',
};

const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

export default function ShiftTemplatesScreen() {
  const [customTemplates, setCustomTemplates] = useState<ShiftTemplate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();


  const loadTemplates = useCallback(async () => {
    if (!user) return;

    try {
      const data = await loadCustomShiftTemplates(user.id);
      setCustomTemplates(data);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить шаблоны');
    }
  }, [user]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleAddTemplate = async () => {
    const name = form.name.trim();
    const startTime = form.startTime.trim();
    const endTime = form.endTime.trim();
    const breakMinutes = Math.min(120, Math.max(0, parseInt(form.breakMinutes || '0', 10) || 0));

    if (!name) {
      Alert.alert('Ошибка', 'Введите название шаблона');
      return;
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      Alert.alert('Ошибка', 'Время должно быть в формате ЧЧ:ММ (например 09:30)');
      return;
    }

    if (!user) {
      Alert.alert('Ошибка', 'Пользователь не найден');
      return;
    }

    setSaving(true);
    try {
      const created = await createCustomShiftTemplate(user.id, {
        name,
        startTime,
        endTime,
        breakMinutes,
      });

      setCustomTemplates((prev) => [...prev, created]);
      setForm(emptyForm);
      Alert.alert('Готово', 'Шаблон сохранен');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить шаблон');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!user) return;

    Alert.alert('Удалить шаблон', 'Вы уверены, что хотите удалить шаблон?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomShiftTemplate(templateId, user.id);
            setCustomTemplates((prev) => prev.filter((item) => item.id !== templateId));
          } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось удалить шаблон');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Шаблоны смен</Text>
        <Text style={styles.subtitle}>Создавай свои шаблоны, чтобы быстрее заполнять смены.</Text>


        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Мои шаблоны</Text>
          {customTemplates.length === 0 ? (
            <Text style={styles.emptyText}>Пока нет своих шаблонов</Text>
          ) : customTemplates.map((template) => (
            <View key={template.id} style={styles.templateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateMeta}>{template.startTime}–{template.endTime} · перерыв {template.breakMinutes} мин</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteTemplate(template.id)}>
                <Text style={styles.deleteText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Новый шаблон</Text>

          <TextInput
            style={styles.input}
            placeholder="Название (например Офис 12-20)"
            placeholderTextColor={Colors.gray}
            value={form.name}
            onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Начало 09:00"
              placeholderTextColor={Colors.gray}
              value={form.startTime}
              onChangeText={(startTime) => setForm((prev) => ({ ...prev, startTime }))}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Конец 17:00"
              placeholderTextColor={Colors.gray}
              value={form.endTime}
              onChangeText={(endTime) => setForm((prev) => ({ ...prev, endTime }))}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Перерыв (мин)"
            placeholderTextColor={Colors.gray}
            keyboardType="numeric"
            value={form.breakMinutes}
            onChangeText={(breakMinutes) => {
              const digitsOnly = breakMinutes.replace(/[^0-9]/g, '');
              if (!digitsOnly) {
                setForm((prev) => ({ ...prev, breakMinutes: '0' }));
                return;
              }
              const normalized = String(Math.min(120, Math.max(0, parseInt(digitsOnly, 10))));
              setForm((prev) => ({ ...prev, breakMinutes: normalized }));
            }}
          />

          <TouchableOpacity style={[styles.addButton, saving && styles.disabled]} onPress={handleAddTemplate} disabled={saving}>
            <Text style={styles.addButtonText}>{saving ? 'Сохранение...' : 'Сохранить шаблон'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray },
  subtitle: { marginTop: 6, fontSize: 14, color: Colors.gray },
  card: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 10,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    gap: 8,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  templateMeta: {
    marginTop: 2,
    color: Colors.gray,
    fontSize: 13,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
  },
  deleteText: {
    color: Colors.error,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: Colors.white,
    color: Colors.darkGray,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  addButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    padding: 12,
  },
  addButtonText: {
    color: Colors.onPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
});
