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
  ActivityIndicator,
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
import * as Haptics from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';

const emptyForm = {
  name: '',
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: '30',
};

const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const formatTimeInput = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export default function ShiftTemplatesScreen() {
  const [customTemplates, setCustomTemplates] = useState<ShiftTemplate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const { user } = useAuth();
  useTheme();
  const styles = createStyles();

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setLoadingInitial(true);
    try {
      const data = await loadCustomShiftTemplates(user.id);
      setCustomTemplates(data);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить шаблоны');
    } finally {
      setLoadingInitial(false);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const created = await createCustomShiftTemplate(user.id, {
        name,
        startTime,
        endTime,
        breakMinutes,
      });

      setCustomTemplates((prev) => [...prev, created]);
      setForm(emptyForm);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

  if (loadingInitial) {
    return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
            <Text style={styles.headerTitle}>Шаблоны смен</Text>
            <Text style={styles.subtitle}>
              Создавайте свои шаблоны, чтобы мгновенно заполнять данные о сменах при их добавлении.
            </Text>
          </View>

          {/* Форма создания */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Новый шаблон</Text>

            <Text style={styles.label}>Название</Text>
            <TextInput
                style={styles.input}
                placeholder="Например: Дневная смена"
                placeholderTextColor={Colors.gray}
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Начало</Text>
                <TextInput
                    style={styles.input}
                    placeholder="09:00"
                    placeholderTextColor={Colors.gray}
                    keyboardType="number-pad"
                    value={form.startTime}
                    onChangeText={(startTime) => setForm((prev) => ({ ...prev, startTime: formatTimeInput(startTime) }))}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Конец</Text>
                <TextInput
                    style={styles.input}
                    placeholder="17:00"
                    placeholderTextColor={Colors.gray}
                    keyboardType="number-pad"
                    value={form.endTime}
                    onChangeText={(endTime) => setForm((prev) => ({ ...prev, endTime: formatTimeInput(endTime) }))}
                />
              </View>
            </View>

            <Text style={styles.label}>Перерыв (минуты)</Text>
            <TextInput
                style={styles.input}
                placeholder="0"
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

            <TouchableOpacity
                style={[styles.addButton, saving && styles.disabled]}
                onPress={handleAddTemplate}
                disabled={saving}
                activeOpacity={0.8}
            >
              {saving ? (
                  <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                  <Text style={styles.addButtonText}>Сохранить шаблон</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Список шаблонов */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Мои шаблоны</Text>
            {customTemplates.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color={Colors.border} />
                  <Text style={styles.emptyText}>У вас пока нет сохраненных шаблонов.</Text>
                </View>
            ) : customTemplates.map((template, index) => (
                <View key={template.id} style={[styles.templateRow, index === customTemplates.length - 1 && styles.lastTemplateRow]}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      ⏰ {template.startTime} — {template.endTime}
                    </Text>
                    {template.breakMinutes > 0 && (
                        <Text style={styles.templateMetaBreak}>
                          ☕ Перерыв: {template.breakMinutes} мин
                        </Text>
                    )}
                  </View>
                  <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteTemplate(template.id)}
                      activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
            ))}
          </View>

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
  loaderContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
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
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.darkGray,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: Colors.lightGray,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  addButton: {
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 16,
  },
  lastTemplateRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  templateInfo: {
    flex: 1,
    paddingRight: 16,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 4,
  },
  templateMeta: {
    color: Colors.darkGray,
    fontSize: 14,
    fontWeight: '500',
  },
  templateMetaBreak: {
    marginTop: 4,
    color: Colors.gray,
    fontSize: 13,
  },
  deleteButton: {
    padding: 10,
    backgroundColor: Colors.lightError,
    borderRadius: 12,
  },
});