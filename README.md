# Cinema API

REST API кінотеатру на NestJS: фільми, зали, сеанси й бронювання місць.
Дані зберігаються в **PostgreSQL** (TypeORM), схема створюється **міграціями**.

## Запуск

Потрібні Node.js 20+ і Docker.

```bash
# 1. Встановити залежності
npm install

# 2. Створити файл оточення з прикладу і заповнити (див. нижче)
cp .env.example .env

# 3. Підняти PostgreSQL через Docker Compose
docker compose up -d

# 4. Застосувати міграції (створює всі таблиці на порожній БД)
npm run migration:run

# 5. (необов'язково) Засіяти БД тестовими даними
npm run seed

# 6. Запустити в режимі розробки
npm run start:dev
```

Застосунок стартує на `http://localhost:3000`, документація Swagger — на [`http://localhost:3000/docs`](http://localhost:3000/docs).
Якщо змінних підключення до БД бракує або вони некоректні, застосунок **не стартує** (валідація `EnvironmentVariables`).

### Приклад `.env`

Один файл використовують і застосунок, і Docker Compose (підставляє `${...}` у `docker-compose.yml`).

```env
# Порт HTTP-сервера (необов'язковий, за замовчуванням 3000)
PORT=3000

# PostgreSQL: POSTGRES_USER/PASSWORD/DB створюють роль і базу на першому старті контейнера
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=cinema
POSTGRES_PASSWORD=cinema
POSTGRES_DB=cinema
```

`POSTGRES_PORT` — порт, який compose публікує на машині. У прикладі `5433`, щоб не конфліктувати з локально встановленим Postgres;
якщо 5432 вільний, можна лишити його.

### Docker Compose

```bash
docker compose up -d      # підняти PostgreSQL 18 у фоні
docker compose ps         # сервіс db має статус Up
docker compose down       # зупинити; дані лишаються в volume cinema-pgdata
docker compose down -v    # зупинити й видалити дані
```

### Міграції

CLI TypeORM працює поза NestJS, тому має окремий `src/data-source.ts` (читає `.env` через `dotenv`).
Проєкт зібраний як ESM, тож скрипти спершу збирають `dist/` і запускають CLI над скомпільованими файлами.

```bash
npm run migration:run                                   # застосувати нові міграції
npm run migration:revert                                # відкотити останню (down)
npm run migration:show                                  # статус міграцій
npm run migration:generate -- src/migrations/<Name>     # нова міграція з різниці entity ↔ БД
```

Застосовані міграції не редагуються: зміна схеми — нова міграція.

### Seed

```bash
npm run seed
```

Дані генерує [`@faker-js/faker`](https://fakerjs.dev/): 4 фільми, 2 зали, 8 сеансів (кожен у свою добу, починаючи із завтра)
і 3 бронювання на вільні місця. Кількість задають константи на початку `src/seed.ts`. Запускати після міграцій.

Повторний запуск нічого не дублює. Faker працює з фіксованим `seed`, тож кожен запуск дає ті самі записи з тими самими `id`,
а вставка йде через `INSERT … ON CONFLICT DO NOTHING`. Версія faker у `package.json` закріплена точно,
бо інша версія з тим самим `seed` генерує інші дані.

## Перевірка

- `requests.http` у корені — запити до кожного маршруту та на кожну помилку. Виконуйте їх по черзі згори вниз
  у VS Code з розширенням [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client).
  Ідентифікатори підставляються з відповідей попередніх запитів.
- `npm test` — unit-тести (репозиторії й DataSource замінені моками).
- `npm run test:e2e` — e2e-тести всього HTTP-циклу на окремій базі `<POSTGRES_DB>_test`
  (створюється автоматично, схема — тими самими міграціями). Потрібен запущений `docker compose`.

## Схема БД

```
films 1 ──< showings >── 1 halls        (FK обов'язкові, без каскаду: 409 на видалення)
              │
              1
              ▼
          bookings 1 ──< booking_seats  (ON DELETE CASCADE)
                         UNIQUE (showing_id, row, seat)
```

- `id` усіх таблиць — `uuid DEFAULT gen_random_uuid()` (`uuidExtension: 'pgcrypto'`).
- Час — `timestamptz`, ціни — `integer` у копійках.
- Перелік місць залу в БД не зберігається — обчислюється з `rows × seats_per_row`.
- `booking_seats.showing_id` навмисно дублює `bookings.showing_id`: унікальний індекс будується
  по колонках однієї таблиці, тож БД сама не дасть продати місце двічі навіть при одночасних запитах.

## Структура

```
src/
├── films/        фільми
├── halls/        зали й обчислення переліку місць
├── showings/     сеанси, пагінація розкладу (Query Builder)
├── bookings/     бронювання (транзакція) й зайнятість місць
├── common/       глобальний фільтр винятків, розпізнавання помилок БД
├── config/       валідація змінних оточення
├── migrations/   міграції TypeORM
├── data-source.ts  DataSource для CLI і seed
└── seed.ts       засівання БД
```

- Кожен модуль має контролер (HTTP), сервіс (логіка) і сутності TypeORM у власній `entities/`.
  Репозиторії реєструються через `TypeOrmModule.forFeature` і впроваджуються `@InjectRepository`.
- Модулі спілкуються лише через експортовані сервіси.
- Доступ до сеансів для інших модулів винесено в окремий сервісний модуль без контролера — `ShowingsCoreModule`
  (`showings/core.module.ts`). Його імпортують `showings`, `bookings`, а також `films` і `halls`, яким треба знати,
  чи є сеанси, щоб відповісти `409` при видаленні. Так зустрічної залежності `films ↔ showings` немає й `forwardRef` не потрібен.

  ```
  ShowingsCoreModule ◄── FilmsModule ◄──┐
         ▲  ▲        ◄── HallsModule ◄──┼── ShowingsModule
         │  └──────────────────────────┘
         └──── BookingsModule ──► HallsModule
  ```
- Підключення до БД — `TypeOrmModule.forRootAsync` з параметрами з `ConfigService` (не `process.env`), `synchronize: false`.
- DTO (class-validator) перевіряють форму даних, сервіси — доменні правила (існування записів, межі залу),
  БД — цілісність (FK, унікальні індекси).
- Глобальні складові зареєстровані провайдерами в `AppModule`, тож тести отримують їх разом із модулем:
  - `APP_PIPE` — `ValidationPipe` з `whitelist: true`: поля поза DTO до сервісу не потрапляють;
  - `APP_FILTER` — `HttpExceptionFilter`: єдиний формат помилки (статус, час, шлях, повідомлення).
- Сервіси пишуть попередження через вбудований `Logger` (не знайдено, конфлікт), фільтр — підсумок `METHOD url -> status`.

## Маршрути

| Метод | Шлях | Опис |
|---|---|---|
| `POST` | `/films` | Створити фільм |
| `GET` | `/films` | Усі фільми |
| `GET` | `/films/:id` | Один фільм |
| `PATCH` | `/films/:id` | Оновити фільм |
| `DELETE` | `/films/:id` | Видалити фільм (`409`, якщо є сеанси) |
| `POST` | `/halls` | Створити зал (назва унікальна, без урахування регістру) |
| `GET` | `/halls` | Усі зали |
| `GET` | `/halls/:id` | Зал із переліком місць |
| `DELETE` | `/halls/:id` | Видалити зал (`409`, якщо є сеанси) |
| `POST` | `/showings` | Створити сеанс |
| `GET` | `/showings?filmId=&date=YYYY-MM-DD&page=1&limit=20&sort=asc` | Сторінка розкладу з фільтрами: `{ items, total, page, limit }` |
| `GET` | `/showings/:id` | Один сеанс |
| `GET` | `/showings/:id/seats` | Місця залу з ознакою `isBooked` |
| `POST` | `/showings/:id/bookings` | Забронювати місця |
| `GET` | `/showings/:id/bookings` | Бронювання сеансу |
| `GET` | `/bookings` | Усі бронювання |
| `DELETE` | `/bookings/:id` | Скасувати бронювання (місця видаляє `ON DELETE CASCADE`) |

### Домовленості

- **Ціни** — цілі числа в копійках (`12500` = 125 грн).
- **Час** сеансу зберігається в колонці `timestamptz` і віддається в UTC (ISO 8601).
  Фільтр `date` відбирає сеанси, що починаються протягом цієї доби **за UTC**.
- **Пагінація** `GET /showings`: `page` — ціле ≥ 1 (за замовчуванням `1`), `limit` — ціле 1–100 (`20`),
  `sort` — `asc` | `desc` (`asc`) за часом початку; при однаковому часі — за `id`.
  Фільтри, сортування й `LIMIT/OFFSET` виконуються одним запитом Query Builder, `total` рахує `getManyAndCount`.
- **Бронювання** пишеться разом з усіма місцями в одній транзакції. Якщо хоч одне місце зайняте
  (унікальний індекс `booking_seats (showing_id, row, seat)`), транзакція відкочується і повертається `409`
  без тексту помилки БД.
- **Ідентифікатори** в параметрах маршруту перевіряє `ParseUUIDPipe`: рядок, що не є UUID, дає `400`,
  неіснуючий UUID — `404`.
- Відповіді на читання сеансів містять `filmTitle` і `hallName` замість `filmId` і `hallId`.
- **Помилки** мають єдиний формат:

  ```json
  {
    "statusCode": 404,
    "timestamp": "2026-11-20T18:30:00.000Z",
    "path": "/films/3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "message": "Фільм з id 3fa85f64-5717-4562-b3fc-2c963f66afa6 не знайдено"
  }
  ```

  Для помилок валідації `message` — масив повідомлень.
