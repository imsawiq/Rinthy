# Rinthy

<div align="center">
  <img src="./public/logo.png" width="128" height="128" alt="Rinthy" />
  <p><strong>A mobile Modrinth dashboard for creators.</strong></p>
  <p>Manage projects, teams, versions, notifications, and analytics from your phone.</p>
</div>

> Rinthy is an unofficial app for Modrinth. It is not affiliated with, endorsed by, or maintained by Modrinth.

## Community

Join the Rinthy Discord server: https://discord.gg/6H5vDq2wk7

## Screenshots

<div align="center">
  <img src="./docs/screenshots/developer-panel.png" width="220" alt="Developer panel" />
  <img src="./docs/screenshots/teams.png" width="220" alt="Teams and organizations" />
  <img src="./docs/screenshots/analytics.png" width="220" alt="Analytics" />
  <img src="./docs/screenshots/glass-theme.png" width="220" alt="Glass theme" />
</div>

## What Rinthy Can Do

- View and manage your Modrinth projects.
- Create projects and edit project metadata, links, descriptions, status, icons, and gallery images.
- Manage versions, loaders, game versions, dependencies, and version metadata.
- Work with teams and organizations, including members, permissions, invites, ownership, and organization projects.
- Open related projects directly from notifications.
- View analytics for downloads, views, playtime, revenue, trends, and per-project performance.
- Check balance and payout history where Modrinth exposes that data.
- Edit your Modrinth profile, avatar, bio, and account details.
- Customize the app with themes, accent colors, language settings, and the newer glass theme.
- Use the app in English, Russian, and other community-contributed languages.

## Downloads

Android builds are published as APK files in GitHub Releases.

iOS builds are distributed as an unsigned IPA for sideloading. To install the iOS app, use Sideloadly on a computer, sign in to iCloud on Apple's official iCloud app/site, connect your iPhone with a cable, install the IPA, then trust the developer profile in iPhone settings and enable Developer Mode if iOS asks.

## Authentication

Rinthy uses Modrinth OAuth for normal sign-in. PAT login is still available as a fallback for development or recovery.

Tokens are stored locally on your device.

## Local Development

### Requirements

- Node.js
- Android Studio for Android builds
- Xcode or a macOS build service for iOS builds

### Install Dependencies

```bash
npm install
```

### Run In Browser

```bash
npm run dev
```

### Typecheck

```bash
npm run typecheck
```

### Build Web App

```bash
npm run build
```

## Android Build

```bash
npm run build
npx cap sync android
npx cap open android
```

Then run the app from Android Studio.

## iOS Build

```bash
npm run build
npx cap sync ios
npx cap open ios
```

For sideloading, build or download the unsigned IPA and install it with Sideloadly.

---

# Русский

Rinthy — неофициальное мобильное приложение для авторов на Modrinth.

С ним можно управлять проектами, версиями, командами, организациями, уведомлениями и аналитикой прямо с телефона.

## Скриншоты

<div align="center">
  <img src="./docs/screenshots/developer-panel.png" width="220" alt="Панель разработчика" />
  <img src="./docs/screenshots/teams.png" width="220" alt="Команды и организации" />
  <img src="./docs/screenshots/analytics.png" width="220" alt="Аналитика" />
  <img src="./docs/screenshots/glass-theme.png" width="220" alt="Glass тема" />
</div>

## Возможности

- Просмотр и управление проектами Modrinth.
- Создание проектов и редактирование метаданных, ссылок, описаний, статуса, иконок и галереи.
- Управление версиями, загрузчиками, версиями игры, зависимостями и метаданными релизов.
- Работа с командами и организациями: участники, права, приглашения, владелец и проекты организации.
- Переход в связанные проекты прямо из уведомлений.
- Аналитика по загрузкам, просмотрам, playtime, доходу, трендам и отдельным проектам.
- Просмотр баланса и истории выплат, если эти данные доступны через Modrinth.
- Редактирование профиля, аватара, био и данных аккаунта.
- Темы, акцентные цвета, выбор языка и обновлённая glass-тема.
- Поддержка русского, английского и других языков, которые помогает добавлять сообщество.

## Установка

Android-версия публикуется APK-файлом в GitHub Releases.

iOS-версия доступна как unsigned IPA для sideloading. Чтобы установить её на iPhone, нужен Sideloadly на ПК, вход в iCloud через официальный iCloud от Apple, iPhone по проводу, установка IPA через Sideloadly, доверие профилю разработчика в настройках iPhone и Developer Mode, если iOS попросит его включить.

## Сообщество

Discord-сервер Rinthy: https://discord.gg/6H5vDq2wk7

## Авторизация

Основной вход работает через Modrinth OAuth. PAT-вход оставлен как запасной вариант для разработки или восстановления доступа.

Токены хранятся локально на устройстве.

## Локальный запуск

### Требования

- Node.js
- Android Studio для Android-сборок
- Xcode или macOS build service для iOS-сборок

### Установка зависимостей

```bash
npm install
```

### Запуск в браузере

```bash
npm run dev
```

### Проверка TypeScript

```bash
npm run typecheck
```

### Сборка web-приложения

```bash
npm run build
```

## Android-сборка

```bash
npm run build
npx cap sync android
npx cap open android
```

После этого приложение можно запускать из Android Studio.

## iOS-сборка

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Для sideloading можно собрать или скачать unsigned IPA и установить его через Sideloadly.
