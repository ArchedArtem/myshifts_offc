# Push в Expo Go работает, а в release нет — чеклист

Если токен генерируется в **Expo Go**, но не появляется в `device_push_tokens` в **release build**, чаще всего проблема в release credentials.

## 1) Проверьте причину в логах приложения
В `registerDevicePushToken` возвращается `reason` с детальной ошибкой (`Push token sync skipped: ...`).

Типичные ошибки:
- `Default FirebaseApp is not initialized` / `Firebase...` → на Android не подключен FCM.
- Ошибки APNs/entitlements → на iOS не настроены push credentials.

## 2) Android (release)
- Добавьте `google-services.json` и укажите его в `app.json` (`expo.android.googleServicesFile`).
- Убедитесь, что build собран через **EAS** для того же projectId.
- В EAS/Expo Project настройте FCM credentials.

## 3) iOS (release)
- В EAS Project настройте APNs key/certificate.
- Проверьте, что push capability/entitlements включены для bundle id.

## 4) База данных
- Примените миграцию `docs/push_notifications_shared_device_fix.sql`, чтобы убрать конфликт по глобальному уникальному токену.

## 5) После правок
- Пересоберите release build.
- Авторизуйтесь заново и проверьте запись в `device_push_tokens`.
