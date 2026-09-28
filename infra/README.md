# Локальная база данных

`compose.yml` поднимает только PostgreSQL 18 с расширением pgvector. API
намеренно запускается непосредственно из Python: это удобнее для отладки на
Windows и не требует контейнеризации сервера на первом этапе.

Перед запуском скопируйте `backend/.env.example` в `backend/.env`, замените
пример пароля и установите `APP_DATA_MODE=postgres`. Затем из корня проекта:

```powershell
docker compose -f .\infra\compose.yml up -d
docker compose -f .\infra\compose.yml ps
```

База доступна только как `127.0.0.1:5432`; не добавляйте внешний порт и не
подключайте к ней мобильное приложение. Миграции выполняются из `backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Остановка без удаления тома: `docker compose -f .\infra\compose.yml down`.
