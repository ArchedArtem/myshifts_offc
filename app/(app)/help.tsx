import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

const faq = [
  {
    q: 'Как работает AI-сканер графиков?',
    a: 'Нажмите на кнопку «AI Сканер», загрузите скриншот или фото вашего расписания. Нейросеть сама найдет рабочие дни, время начала, окончания и посчитает перерывы.',
  },
  {
    q: 'Можно ли поправить смены после сканирования?',
    a: 'Да! Когда сканер найдет смены, появится список. Просто нажмите на время, перерыв или название смены, чтобы отредактировать ошибку, а затем нажмите «Добавить все».',
  },
  {
    q: 'Сканер выдает ошибку «Сервера перегружены». Что делать?',
    a: 'Это временное ограничение нейросети из-за высокой нагрузки. Просто подождите 1-2 минуты и попробуйте снова.',
  },
  {
    q: 'Как добавить смену вручную?',
    a: 'На главном экране нажмите кнопку «+», заполните дату, время, ставку и сохраните.',
  },
  {
    q: 'Как изменить ставку по умолчанию?',
    a: 'Откройте Профиль → Настройки и укажите «Ставка по умолчанию (₽/ч)».',
  },
  {
    q: 'Почему не видно новый заработок в статистике?',
    a: 'Потяните экран статистики вниз для обновления данных.',
  },
  {
    q: 'Как удалить смену?',
    a: 'На главном экране нажмите на карточку смены → «Удалить».',
  },
  {
    q: 'Почему сумма отличается от моей?',
    a: 'Если в настройках включен учет НДФЛ, итог показывается после удержания 13%. Также сумма может меняться из-за перерывов, доплат и округления минут.',
  },
];

export default function HelpScreen() {
  useTheme();
  const styles = createStyles();

  const openEmail = async () => {
    const url = 'mailto:archedartem@gmail.com?subject=Поддержка%20"Мои смены"';

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
          'Ошибка',
          'Не удалось открыть почтовый клиент. Напишите нам вручную: archedartem@gmail.com',
      );
    }
  };

  return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Помощь</Text>
        <Text style={styles.subtitle}>Частые вопросы и быстрые способы связи.</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>FAQ</Text>
          {faq.map((item) => (
              <View key={item.q} style={styles.faqItem}>
                <Text style={styles.q}>{item.q}</Text>
                <Text style={styles.a}>{item.a}</Text>
              </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Связаться с поддержкой</Text>
          <TouchableOpacity style={styles.contactButton} onPress={openEmail}>
            <Text style={styles.contactButtonText}>Написать на email</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Обычно отвечаем в течение 24 часов.</Text>
        </View>
      </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.darkGray, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray, marginBottom: 16 },
  block: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 16 },
  blockTitle: { fontSize: 16, fontWeight: '700', color: Colors.darkGray, marginBottom: 10 },
  faqItem: { marginBottom: 12 },
  q: { fontSize: 15, fontWeight: '600', color: Colors.darkGray, marginBottom: 4 },
  a: { fontSize: 14, color: Colors.gray, lineHeight: 20 },
  contactButton: { marginTop: 4, backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  contactButtonText: { color: Colors.onPrimary, fontSize: 15, fontWeight: '600' },
  note: { marginTop: 10, fontSize: 13, color: Colors.gray },
});