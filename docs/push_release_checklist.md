# Push в Expo Go работает, а в release нет — чеклист

Если токен генерируется в **Expo Go**, но не появляется в `device_push_tokens` в **release build**, чаще всего проблема в release credentials.

## 1) Проверьте причину в логах приложения
В `registerDevicePushToken` возвращается `reason` с детальной ошибкой (`Push token sync skipped: ...`).

Типичные ошибки:
- `Default FirebaseApp is not initialized` / `Firebase...` → на Android не подключен FCM.
- Ошибки APNs/entitlements → на iOS не настроены push credentials.

Если видите ошибку вроде `Default FirebaseApp is not initialized` — это почти всегда означает, что release APK/AAB собран без корректного `google-services.json`.

## 1.1) Как зайти в логи release-сборки

### Android (самый простой путь)
1. Подключите телефон по USB и включите USB debugging.
2. Установите Android Platform Tools (`adb`).
3. Запустите:
   - `adb devices`
   - `adb logcat | grep -i -E "push|expo|myshifts|firebase"`

Если `grep` недоступен, используйте просто `adb logcat` и фильтруйте вручную.

### iOS
- Если сборка из Xcode: откройте **Xcode → Devices and Simulators → Open Console** для подключенного устройства.
- Если TestFlight/App Store: используйте **Console.app** (macOS) для live-логов устройства и/или crash/logs в App Store Connect (Diagnostics).

Подсказка: ищите в логах строку `Push token sync skipped:` — там будет текст причины, который возвращает `registerDevicePushToken`.

## 2) Android (release)
- Добавьте `google-services.json` в корень проекта и укажите его в `app.json` (`expo.android.googleServicesFile`).
- Убедитесь, что build собран через **EAS** для того же projectId.
- В EAS/Expo Project настройте FCM credentials.

Практически:
1. В Firebase Console выберите Android app с package `com.rasthartem.myshifts`.
2. Скачайте `google-services.json` и положите в корень проекта.
3. Проверьте, что в `app.json` есть:
   - `"android": { "googleServicesFile": "./google-services.json", ... }`
4. Загрузите/обновите credentials и пересоберите:
   - `eas credentials -p android`
   - `eas build -p android --profile production --clear-cache`

## 3) iOS (release)
- В EAS Project настройте APNs key/certificate.
- Проверьте, что push capability/entitlements включены для bundle id.

## 4) База данных
- Примените миграцию `docs/push_notifications_shared_device_fix.sql`, чтобы убрать конфликт по глобальному уникальному токену.

## 5) После правок
- Пересоберите release build.
- Авторизуйтесь заново и проверьте запись в `device_push_tokens`.
