import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/haptics';

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Помощь</Text>
          <Text style={styles.subtitle}>Частые вопросы и способы связи с разработчиком.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FAQ</Text>
          {faq.map((item, index) => {
            const isLast = index === faq.length - 1;
            return (
                <View key={item.q} style={[styles.faqItem, isLast && styles.lastFaqItem]}>
                  <View style={styles.questionRow}>
                    <View style={styles.qIcon}>
                      <Ionicons name="help-circle-outline" size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.qText}>{item.q}</Text>
                  </View>
                  <Text style={styles.aText}>{item.a}</Text>
                </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="mail-outline" size={24} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Поддержка</Text>
              <Text style={styles.contactNote}>Отвечаем в течение 24 часов</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.contactButton} onPress={openEmail} activeOpacity={0.8}>
            <Text style={styles.contactButtonText}>Написать на email</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastFaqItem: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  qText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.darkGray
  },
  aText: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    paddingLeft: 38,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  contactIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactNote: {
    fontSize: 13,
    color: Colors.gray,
    marginTop: 2,
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  contactButtonText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
});