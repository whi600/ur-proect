# ПравоОрбита — технический каркас

Временное рабочее имя проекта — **«ПравоОрбита»**. Это не готовый продукт и не
связано с брендом, дизайном, базой данных или материалами «КонсультантПлюс».
Проверка имени на товарные знаки в этот этап не входила.

Каркас включает Expo-приложение для iOS/Android, FastAPI API и подготовленную
локальную конфигурацию PostgreSQL + pgvector. В веб-предпросмотре доступен
автономный каталог реквизитов: Конституция, 20 кодексов и 13 ключевых законов.
В текущем локальном нативном окружении дополнительно подключён снимок текстов
37 документов (10 807 статей) из стороннего открытого источника. Он работает
без сети, но **не** является юридически проверенной или гарантированно
актуальной редакцией. Учебные карточки и ответы помощника остаются отдельно
помеченными демонстрационными материалами.

## Структура

```text
mobile/    Expo + React Native + TypeScript + Expo Router
backend/   FastAPI, SQLAlchemy, Alembic, тесты
infra/     Docker Compose для локального PostgreSQL + pgvector
docs/      архитектура и запуск с iPhone
```

Подробнее: [архитектура](docs/architecture.md), [контракт API](docs/api.md), [iPhone и локальная сеть](docs/iphone.md). Для первого запуска Expo Go сохранена отдельная пошаговая [памятка](docs/expo-go-later.md). Решения редизайна и использованные UX-источники сохранены в [документе по UX](docs/ux-redesign.md). Статус офлайн-каталога и безопасная подготовка будущих текстовых пакетов описаны в [документе об офлайн-каталоге](docs/offline-catalog.md) и [документе по правовым источникам](docs/russian-legal-sources.md).

Для отдельной установки без ИИ-помощника подготовлены PWA для iPhone и профиль
APK для Android: [инструкция](docs/pwa-and-android.md).

Быстрый повторный запуск Android-сборки из PowerShell:

```powershell
Set-Location 'C:\Users\User\Documents\ChatGPT\консультант плюс ( с ИИ)\mobile'
npx eas login
npm run android:configure # только перед первой сборкой, после входа в Expo
npm run android:apk
```

## Первый запуск после получения проекта

```powershell
# Один раз: зависимости мобильного приложения (используется только npm).
Set-Location .\mobile
npm install

# Один раз: изолированное Python-окружение и зафиксированные зависимости API.
Set-Location ..\backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r .\requirements.lock

# Локальные, не попадающие в Git настройки (создаются лишь если отсутствуют).
if (-not (Test-Path .\.env)) { Copy-Item .\.env.example .\.env }
Set-Location ..\mobile
if (-not (Test-Path .\.env)) { Copy-Item .\.env.example .\.env }
```

В `mobile/.env` указывается только LAN-адрес API. Не добавляйте туда ключи,
пароли или адрес PostgreSQL.

## HTTP API

В режиме `APP_DATA_MODE=demo` API возвращает стартовые карточки локального
каталога и отдельно помеченные учебные материалы:

```text
GET  /api/v1/health
GET  /api/v1/documents?q=<необязательно>
GET  /api/v1/documents/{document_id}
GET  /api/v1/search?q=<запрос>
POST /api/v1/assistant/ask
```

Для `POST /assistant/ask` передаются `question`, а при наличии —
`as_of_date` и `circumstances`. Сервер всегда возвращает `mode: "demo"` на
этом этапе и явно указывает, что это не ответ реальной ИИ-модели.

## Быстрый запуск в демонстрационном режиме

В демонстрационном режиме PostgreSQL не нужен: API отдаёт встроенный каталог
реквизитов и отдельно помеченные учебные примеры.

```powershell
# 1. API — окно PowerShell №1
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
Set-Location .\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Мобильное приложение — окно PowerShell №2
Set-Location <путь-к-проекту>\mobile
if (-not (Test-Path .\.env)) { Copy-Item .\.env.example .\.env }
# Укажите в .env LAN-IP компьютера, например:
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:8000/api/v1
npx expo login
npm run start:lan
```

`npx expo login` открывает вход в бесплатный Expo-аккаунт. На iPhone нужно
войти в Expo Go под **тем же** аккаунтом. Для текущей App Store версии Expo Go
это требуется для запуска SDK 57-проектов.

Проверить API с компьютера можно до запуска телефона:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/search?q=%D0%BA%D0%BE%D0%B4%D0%B5%D0%BA%D1%81%D1%8B'
```

Остановить API: `Ctrl+C` в его окне. Остановить Expo: `Ctrl+C` в окне Expo.

## Открыть интерфейс на этом ноутбуке

Не требуется iPhone или Expo-аккаунт. API и веб-версия запускаются в двух
окнах PowerShell:

```powershell
# Окно 1: API
Set-Location '<путь-к-проекту>\backend'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Окно 2: веб-версия приложения
Set-Location '<путь-к-проекту>\mobile'
npm run web
```

Откройте `http://localhost:8081`. Веб-версия автоматически использует
`EXPO_PUBLIC_API_BASE_URL_WEB=http://127.0.0.1:8000/api/v1`; настройка для
будущего iPhone остаётся отдельной. В браузере не загружается большой SQLite
снимок: это осознанно оставляет веб-предпросмотр лёгким и показывает только
карточки реквизитов.

## Локальный снимок текстов для Expo Go

В текущей рабочей папке создан файл
`mobile/assets/legal/ru-core-snapshot-2026-09-25.db` (около 130 МБ). Он
игнорируется Git, потому что это производный сторонний пакет, а не исходный код
проекта. При первом старте Expo Go копирует его во внутреннее хранилище
приложения и затем открывает статьи без API и интернета.

Пакет имеет статус `source_snapshot` / `not_reviewed`. Не называйте его
официальной правовой базой, не используйте как основание для юридического
заключения и не передавайте его ИИ как проверенный источник. Для воспроизведения
нужны предварительно проверенные локальные исходники из
[аудита](docs/totopolis-audit-2026-09-26.md); команда не выполняет скачиваний:

```powershell
Set-Location <путь-к-проекту>
.\backend\.venv\Scripts\python.exe .\backend\scripts\import_totopolis_snapshot.py `
  --source-root .\.cache\totopolis-laws-audit-content\laws-main `
  --output .\mobile\assets\legal\ru-core-snapshot-2026-09-25.db `
  --allow-mobile-asset

.\backend\.venv\Scripts\python.exe .\backend\scripts\import_totopolis_snapshot.py `
  --check `
  --output .\mobile\assets\legal\ru-core-snapshot-2026-09-25.db `
  --allow-mobile-asset
```

## Локальная PostgreSQL (необязательно на этом этапе)

После запуска Docker Desktop:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
# В backend/.env задайте APP_DATA_MODE=postgres и надёжный POSTGRES_PASSWORD.
docker compose -f .\infra\compose.yml up -d
Set-Location .\backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

PostgreSQL публикуется только на `127.0.0.1`, поэтому телефон к ней не
подключается. Обычная остановка сохраняет данные:

```powershell
docker compose -f .\infra\compose.yml down
```

Не используйте `down -v`, если хотите сохранить локальную базу.

## Проверки

```powershell
# Mobile
Set-Location .\mobile
npm run check
npx expo-doctor@latest

# Backend
Set-Location ..\backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
.\.venv\Scripts\mypy.exe app

# Проверка встроенного каталога и шаблона будущего текстового пакета
Set-Location ..
.\backend\.venv\Scripts\python.exe .\backend\scripts\build_offline_catalog.py --check
.\backend\.venv\Scripts\python.exe .\backend\scripts\validate_legal_package.py --self-test

# Техническая проверка уже собранного снимка (не verified_text)
.\backend\.venv\Scripts\python.exe .\backend\scripts\import_totopolis_snapshot.py `
  --check `
  --output .\mobile\assets\legal\ru-core-snapshot-2026-09-25.db `
  --allow-mobile-asset
```

Перед коммитом проверьте, что секреты не отслеживаются:

```powershell
git status --ignored --short
git ls-files | Select-String -Pattern '(^|/)(\.env|.*\.pem|.*\.key)$'
```

Сторонний источник и обязательное уведомление BSD-2-Clause описаны в
[docs/third-party-notices.md](docs/third-party-notices.md). Технический
снимок нельзя называть проверенной действующей правовой базой без отдельной
сверки и юридического редакторского ревью.
