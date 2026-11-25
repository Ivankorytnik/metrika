# ATOM Metrics

Закрытый дашборд по Яндекс Метрике (счётчик 93465127) для сотрудников @atom.team.
Cloudflare Worker проверяет JWT Cloudflare Access до выдачи любых файлов и API и ходит в Reporting API только GET-запросами с токеном `metrika:read`. Без настроек Access Worker отвечает 503 и ничего не отдаёт.

## Возможности
- Обзор, графики, воронка форм, качество и оценка данных (вкладка «Оценка данных» показывает недостающие цели).
- Конструктор графиков: показатель (визиты, уникальные, просмотры, просмотры и посетители страницы, цели), разрез (дни, недели, месяцы, источники, устройства, страницы), сайт, фильтр по пути страницы. Запросы проходят белый список на сервере.
- Синхронизация: ежечасный cron пишет отчёт за 30 дней в KV, кнопка «Синхронизировать» запрашивает Метрику напрямую, на экране время последней успешной синхронизации.

## Развёртывание (бесплатные тарифы)
1. GitHub → Settings → Secrets and variables → Actions: `CLOUDFLARE_API_TOKEN` (шаблон «Edit Cloudflare Workers» + права Workers KV Storage: Edit), `CLOUDFLARE_ACCOUNT_ID`.
2. Push в `main` запускает тесты и деплой (`.github/workflows/deploy.yml`). KV `atom-metrika-cache` создаётся автоматически.
3. Cloudflare Zero Trust (Free) → Access → Applications → Self-hosted: домен `atom-metrika-dashboard.<subdomain>.workers.dev`, политика Allow → Emails ending in `@atom.team`, вход One-time PIN. Скопировать Application Audience (AUD).
4. Секреты Worker (в GitHub Actions secrets или в Cloudflare → Worker → Settings → Variables): `CF_ACCESS_TEAM` (имя команды из `<team>.cloudflareaccess.com`), `CF_ACCESS_AUD`, `METRIKA_READ_TOKEN` (OAuth-токен с единственным правом `metrika:read`).
5. Проверка: без входа `/`, `/dashboard.js`, `/api/sync` дают 403/503; вход с адресом @atom.team открывает дашборд.

Тесты: `node --test` (Node 22+).
