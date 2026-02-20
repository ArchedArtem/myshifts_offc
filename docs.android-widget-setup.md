# Android виджет «Ближайшая смена» для MyShifts

Этот проект уже подготовлен под виджет через `react-native-android-widget`.

## Что уже добавлено в код

- JS/TS-логика виджета: `services/androidWidget.tsx`
- Регистрация обработчика виджета на старте приложения: `app/_layout.tsx`
- Авто-синхронизация после входа/выхода: `hooks/useAuth.tsx`
- Обновление виджета после добавления/редактирования/удаления смены:
  - `app/(app)/shift-edit.tsx`
  - `app/(app)/index.tsx`
- Конфиг плагина виджета в Expo: `app.json`

## Что тебе сделать в Android Studio (пошагово)

### 1) Сгенерировать Android-файлы виджета

Если ты меняешь `app.json`, нужно синхронизировать native-проект:

```bash
npx expo prebuild --platform android
```

> Если у тебя есть локальные правки в `android/`, делай перед этим commit/backup.

### 2) Проверить, что файлы создались

После `prebuild` должны появиться/обновиться файлы:

- `android/app/src/main/java/com/rasthartem/myshifts/widget/NextShiftWidget.java`
- `android/app/src/main/res/xml/widgetprovider_nextshiftwidget.xml`

И в манифесте приложения должны быть записи:

- `service` — `com.reactnativeandroidwidget.RNWidgetCollectionService`
- `receiver` — `.widget.NextShiftWidget`

Файл:

- `android/app/src/main/AndroidManifest.xml`

### 3) Собрать и установить debug-сборку

Через Android Studio:

- `Sync Project with Gradle Files`
- `Run 'app'`

Либо командой:

```bash
npx expo run:android
```

### 4) Добавить виджет на рабочий стол

На телефоне:

1. Зажми пустое место на рабочем столе
2. Нажми «Виджеты»
3. Найди **MyShifts — Ближайшая смена**
4. Добавь виджет

### 5) Проверка сценариев

- Войти в аккаунт → виджет показывает ближайшую смену
- Добавить/изменить/удалить смену → виджет обновляется
- Выйти из аккаунта → виджет показывает «Войдите в аккаунт»

## Если не хочешь использовать prebuild и делать руками

Минимальный набор, который нужно создать/проверить вручную:

1. `android/app/src/main/java/com/rasthartem/myshifts/widget/NextShiftWidget.java`

```java
package com.rasthartem.myshifts.widget;

import com.reactnativeandroidwidget.RNWidgetProvider;

public class NextShiftWidget extends RNWidgetProvider {
}
```

2. `android/app/src/main/res/xml/widgetprovider_nextshiftwidget.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="90dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:resizeMode="horizontal|vertical"
    android:initialLayout="@layout/rn_widget"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen" />
```

3. `android/app/src/main/AndroidManifest.xml`

- добавить `RNWidgetCollectionService` в `<application>`
- добавить `receiver` для `NextShiftWidget` с `meta-data android.appwidget.provider`

