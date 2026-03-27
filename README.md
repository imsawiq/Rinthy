# Rinthy

<div align="center">
  <img src="./public/logo.png" width="128" height="128" alt="Rinthy" />
</div>

# **EN**

Rinthy is a mobile app for Modrinth developers.

It helps you manage your projects and check analytics right from your phone.

**Disclaimer:** Unofficial app for Modrinth. Not affiliated with or endorsed by Modrinth.

## Screenshots

<div align="center">
  <img src="./docs/screenshots/login.png" width="280" alt="Login" />
  <img src="./docs/screenshots/developer-panel.png" width="280" alt="Developer Panel" />
  <img src="./docs/screenshots/analytics.png" width="280" alt="Analytics" />
</div>

## Features

- **Projects dashboard** (your projects list)
- **Project editing** (title/summary/description, links, status)
- **Project team management** (members)
- **Versions management** (view/edit versions)
- **Analytics overview** (downloads/follows)
- **Notifications** (unread notifications)
- **Profile editing** (username, bio, avatar)
- **Appearance settings** (theme, accent color)
- **RU/EN language support**
- **Balance view**

## Getting started (Local development)

### Requirements

- Node.js
- Android Studio (for Android builds)

### Install

```bash
npm install
```

### Run in browser (dev)

```bash
npm run dev
```

## Android build (Capacitor)

### Build web bundle

```bash
npm run build
```

### Sync assets to Android

```bash
npx cap sync android
```

If you changed Android deep link settings for OAuth, run sync again before opening Android Studio.

### Open Android Studio

```bash
npx cap open android
```

### Run on device

From Android Studio: **Run**

## Authentication

Rinthy uses **Modrinth OAuth** as the primary sign-in method.

- Deploy the companion auth backend to Vercel
- Configure the Modrinth application redirect URI to your backend callback
- Sign in with the `Continue with Modrinth` button in the app

PAT login is still available as a fallback.

**Security note:** the token is stored locally on your device.

---

# Русский

Rinthy — это мобильное приложение для разработчиков на Modrinth.

С помощью Rinthy можно управлять проектами и смотреть аналитику прямо с телефона.

**Дисклеймер:** неофициальное приложение для Modrinth. Не связано с Modrinth и не поддерживается ими.

## Скриншоты

<div align="center">
  <img src="./docs/screenshots/login.png" width="280" alt="Login" />
  <img src="./docs/screenshots/developer-panel.png" width="280" alt="Developer Panel" />
  <img src="./docs/screenshots/analytics.png" width="280" alt="Analytics" />
</div>

## Возможности

- **Список проектов**
- **Редактирование проекта** (название/краткое описание/описание, ссылки, статус)
- **Управление командой проекта** (участники)
- **Управление версиями** (просмотр/редактирование)
- **Аналитика** (загрузки/подписки)
- **Уведомления**
- **Редактирование профиля** (ник, био, аватар)
- **Настройки внешнего вида** (тема, основной цвет)
- **Поддержка RU/EN**
- **Просмотр баланса**

## Запуск локально

### Требования

- Node.js
- Android Studio (для сборки Android)

### Установка

```bash
npm install
```

### Запуск в браузере

```bash
npm run dev
```

## Сборка Android (Capacitor)

### Сборка web

```bash
npm run build
```

### Синхронизация в Android

```bash
npx cap sync android
```

Если менял Android deep link для OAuth, снова выполни sync перед открытием Android Studio.

### Открыть Android Studio

```bash
npx cap open android
```

## Авторизация

Основной вход в Rinthy теперь работает через **Modrinth OAuth**.

Вход по PAT оставлен как запасной вариант.

- Открой: https://modrinth.com/settings/pats
- Создай новый токен
- Выдай нужные права, если хочешь использовать PAT fallback

**Важно:** токен хранится локально на устройстве.
