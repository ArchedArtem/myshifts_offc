import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';
import Colors from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

type Section = {
  title: string;
  items: string[];
};

const defaultPrivacySections: Section[] = [
  {
    title: '1. Общие положения',
    items: [
      '1.1. Оператором персональных данных является физическое лицо Игошин А.И.',
      '1.2. Использование приложения и сайта означает согласие пользователя с настоящей Политикой.',
      '1.3. Сервис предназначен для личного, некоммерческого использования.',
    ],
  },
  {
    title: '2. Персональные данные',
    items: [
      'В рамках работы сервиса могут обрабатываться следующие данные:',
      '• Email (обязательно, для входа);',
      '• Имя (по желанию);',
      'Сервис не обрабатывает специальные категории персональных данных.',
    ],
  },
  {
    title: '3. Цели обработки',
    items: [
      'Персональные данные обрабатываются для:',
      '• регистрации и авторизации пользователя;',
      '• предоставления доступа к функционалу сервиса;',
      '• хранения и обработки данных о сменах;',
      '• обеспечения корректной работы сервиса;',
      '• обработки добровольной финансовой поддержки проекта.',
    ],
  },
  {
    title: '4. Условия обработки, ИИ и Платежи',
    items: [
      '4.1. Обработка персональных данных осуществляется в электронном виде.',
      '4.2. Персональные данные могут передаваться третьим лицам исключительно в случаях, необходимых для функционирования сервиса.',
      '4.3. В приложении используется функция «AI-сканер» для распознавания графиков. При использовании этой функции изображение отправляется на серверы сторонних провайдеров нейросетей исключительно для извлечения текстовой информации.',
      '4.4. Исходные изображения не сохраняются на серверах приложения и не используются для обучения ИИ-моделей.',
      '4.5. Администрация сервиса не получает и не хранит данные банковских карт пользователей.',
      '4.6. При оказании добровольной поддержки обработка платежей осуществляется на стороне защищенного платежного шлюза (ЮKassa / ООО НКО «ЮМани»).',
    ],
  },
  {
    title: '5. Сроки обработки',
    items: [
      'Персональные данные хранятся в течение всего срока использования сервиса и удаляются после удаления аккаунта пользователем.',
    ],
  },
  {
    title: '6. Удаление данных',
    items: [
      'Пользователь может в любой момент:',
      '• удалить аккаунт в настройках приложения;',
      '• направить запрос на электронную почту оператора.',
    ],
  },
  {
    title: '7. Контакты',
    items: [
      'По всем вопросам, связанным с обработкой персональных данных:',
      'Email: archedartem@gmail.com',
    ],
  },
];

const defaultTermsSections: Section[] = [
  {
    title: '1. Общие положения',
    items: [
      '1.1. Приложение «Мои смены» предоставляется бесплатно физическим лицом Игошин А.И.',
      '1.2. Приложение предназначено для личного учёта рабочих смен и расчёта заработка.',
      '1.3. Использование приложения означает согласие пользователя с условиями настоящего Соглашения.',
    ],
  },
  {
    title: '2. Использование приложения',
    items: [
      '2.1. Пользователь самостоятельно вводит данные о рабочих сменах или использует функцию автоматического сканирования.',
      '2.2. Пользователь несёт ответственность за достоверность вводимых и сохраняемых данных.',
      '2.3. Все расчёты, отображаемые в приложении, носят информационный и справочный характер.',
    ],
  },
  {
    title: '3. Ограничение ответственности и ИИ',
    items: [
      '3.1. Приложение не является бухгалтерским или налоговым сервисом.',
      '3.2. Работа функции «AI-сканер» основана на технологиях искусственного интеллекта и носит вероятностный характер.',
      '3.3. Пользователь обязан самостоятельно проверять корректность данных, распознанных AI-сканером, перед их окончательным сохранением.',
      '3.4. Разработчик не несёт ответственности за ошибки в расчётах, возникшие из-за неверного распознавания данных нейросетью или ошибок ручного ввода.',
    ],
  },
  {
    title: '4. Добровольная финансовая поддержки',
    items: [
      '4.1. Пользователь вправе по собственной инициативе оказать добровольную финансовую поддержку разработчику проекта.',
      '4.2. Добровольная финансовая поддержка не является оплатой услуг, покупкой цифровых товаров или подпиской.',
      '4.3. Оказание добровольной финансовой поддержки не предоставляет пользователю каких-либо дополнительных функций в приложении.',
      '4.4. Все транзакции проводятся через сторонний платежный сервис (ЮKassa). Разработчик не несёт ответственности за технические ошибки или сбои на стороне платежной системы.',
      '4.5. Добровольная поддержка осуществляется безвозмездно, возврат переведенных средств не предусмотрен.',
    ],
  },
  {
    title: '5. Прекращение использования',
    items: [
      '5.1. Пользователь вправе прекратить использование приложения в любой момент.',
      '5.2. Удаление аккаунта приводит к удалению связанных с ним данных.',
    ],
  },
  {
    title: '6. Заключительные положения',
    items: [
      '6.1. Разработчик вправе вносить изменения в настоящее Соглашение.',
      '6.2. Актуальная версия документов всегда доступна по данной странице.',
    ],
  },
];


export default function LegalScreen() {
  useTheme();
  const styles = createStyles();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const isTerms = doc === 'terms';
  const docType = isTerms ? 'terms' : 'privacy';
  const title = isTerms ? 'Пользовательское соглашение' : 'Политика конфиденциальности';
  const intro = isTerms
      ? 'Настоящее Пользовательское соглашение определяет условия использования мобильного приложения «Мои смены».'
      : 'Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей мобильного приложения и сайта «Мои смены».';

  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDocument = async () => {
      const cacheKey = `@legal_${docType}`;

      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          setSections(JSON.parse(cachedData));
          setIsLoading(false);
        }

        const { data, error } = await supabase
            .from('legal_docs')
            .select('sections')
            .eq('doc_type', docType)
            .single();

        if (data && data.sections) {
          const remoteDataString = JSON.stringify(data.sections);
          if (cachedData !== remoteDataString) {
            setSections(data.sections);
            await AsyncStorage.setItem(cacheKey, remoteDataString);
          }
        } else if (!cachedData) {
          setSections(isTerms ? defaultTermsSections : defaultPrivacySections);
        }

      } catch (error) {
        console.error('Ошибка загрузки документов:', error);
        if (sections.length === 0) {
          setSections(isTerms ? defaultTermsSections : defaultPrivacySections);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [docType]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.intro}>{intro}</Text>

        {isLoading && sections.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
            sections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.items.map((item, idx) => (
                      <Text key={idx} style={styles.paragraph}>{item}</Text>
                  ))}
                </View>
            ))
        )}
      </ScrollView>
  );
}


const createStyles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 30 },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  title: { fontSize: 26, fontWeight: '800', color: Colors.darkGray, marginBottom: 10 },
  intro: { fontSize: 14, lineHeight: 21, color: Colors.gray, marginBottom: 12 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.darkGray, marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 21, color: Colors.darkGray, marginBottom: 6 },
});