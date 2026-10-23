# Cinema API

REST API кінотеатру на NestJS: фільми, зали, сеанси й бронювання місць.
Дані зберігаються в **PostgreSQL** (TypeORM), схема створюється **міграціями**.
Користувачі входять за поштою й паролем і отримують пару токенів: **JWT access** + **refresh** з ротацією.
Розкладом і довідниками керує **адміністратор**, бронюють місця **авторизовані користувачі**.

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

# 5. Засіяти БД тестовими даними й створити адміністратора (ADMIN_EMAIL / ADMIN_PASSWORD з .env)
npm run seed

# 6. Запустити в режимі розробки
npm run start:dev
```

Застосунок стартує на `http://localhost:3000`, документація Swagger — на [`http://localhost:3000/docs`](http://localhost:3000/docs).
Якщо змінних бракує або вони некоректні, застосунок **не стартує** (валідація `EnvironmentVariables`).

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

# JWT: секрет підпису access-токена (мінімум 32 символи).
# Згенерувати: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=change-me-to-a-long-random-string-of-64-chars-0123456789abcdef
# Час життя access-токена у ХВИЛИНАХ (1–60) і refresh-токена в ДНЯХ (1–365)
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30

# Перший адміністратор, якого створює `npm run seed` (пароль — 8–72 символи)
ADMIN_EMAIL=admin@cinema.local
ADMIN_PASSWORD=admin-password-123
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

Засіяні бронювання належать адміністратору (див. нижче). Повторний запуск нічого не дублює. Faker працює з фіксованим `seed`, тож кожен запуск дає ті самі записи з тими самими `id`,
а вставка йде через `INSERT … ON CONFLICT DO NOTHING`. Версія faker у `package.json` закріплена точно,
бо інша версія з тим самим `seed` генерує інші дані.

### Створення першого адміністратора

Через API адміністратора не створити: `POST /auth/register` завжди дає роль `user`, а поле `role` з тіла відкидається.
Першого адміністратора створює **seed** з даних змінних оточення:

1. Задай у `.env` `ADMIN_EMAIL` і `ADMIN_PASSWORD` (валідуються так само, як у застосунку: коректна пошта, пароль 8–72 символи).
2. Застосуй міграції й виконай `npm run seed`.
3. Увійди: `POST /auth/login` з цими поштою й паролем → `{ accessToken, refreshToken }`.

Seed хешує пароль bcrypt і вставляє користувача з роллю `admin` (`INSERT … ON CONFLICT (email) DO UPDATE SET role, password_hash`):

- якщо адміністратора ще немає — створюється;
- якщо користувач із цією поштою вже є — йому ставиться роль `admin` і пароль з `ADMIN_PASSWORD`
  (зареєстрований кимось обліковий запис не стає адміністратором зі своїм паролем);
- повторний запуск нічого не дублює.

Підняти роль іншому користувачу вручну:

```bash
docker compose exec db psql -U cinema -d cinema -c "UPDATE users SET role = 'admin' WHERE email = 'olena@example.com';"
```

Після зміни ролі треба **увійти знову** (або оновити пару через `/auth/refresh`): роль підписана в access-токені.

## Автентифікація

```
register ──► bcrypt.hash ──► users
login    ──► bcrypt.compare ──► access (JWT {sub, role}, хвилини) + refresh (randomBytes, SHA-256 у БД, дні)
запит    ──► JwtAuthGuard (Bearer, @Public) ──► RolesGuard (@Roles) ──► handler (@CurrentUser)
refresh  ──► DELETE … WHERE token_hash = $1 AND expires_at > now() RETURNING user_id ──► нова пара, роль з БД
logout   ──► DELETE … WHERE token_hash = $1 AND user_id = $2 (інакше 404)
```

- Access-токен передається в заголовку `Authorization: Bearer <token>`. Відсутній заголовок, інша схема,
  недійсний підпис чи прострочений токен → `401`.
- **Пароль** зберігається лише як bcrypt-хеш. Хеш позначено `@Exclude()`, а глобальний `ClassSerializerInterceptor`
  прибирає його з відповідей (сервіси повертають екземпляри класу `User`). Тіла запитів не логуються.
- Помилка входу **однакова** для неіснуючої пошти й неправильного пароля.
- **Refresh-токен** — випадкові 32 байти (не JWT). У таблиці `refresh_tokens` лежить лише його SHA-256-хеш:
  детермінований, тож токен можна знайти `WHERE token_hash = $1`. bcrypt тут не підходить, бо солить хеш.
- **Ротація**: старий токен споживається одним атомарним `DELETE … RETURNING`. З двох паралельних запитів
  з тим самим токеном пару отримає лише один, другий дістане `401`. Окремих «знайти» + «видалити» немає.
- Користувач може мати кілька refresh-токенів (вхід з різних пристроїв); `logout` відкликає лише переданий.
- Guards глобальні (`APP_GUARD` в `AuthModule`, порядок реєстрації = порядок виконання):
  `JwtAuthGuard` перевіряє токен і кладе payload у `request.user`, `RolesGuard` порівнює роль з `@Roles()`.
  Маршрути без токена позначені `@Public()`. Passport не використовується.
- **Власника** бронювання перевіряє `BookingsService`, а не guard, бо для цього потрібен запит до БД.
  Чуже бронювання → `403` (id — UUID, перебрати їх неможливо), адміністратор скасовує будь-яке.
- Swagger (`/docs`): кнопка **Authorize** (схема Bearer), захищені маршрути позначені замочком і описують `401` / `403`.

## Перевірка

- `requests.http` у корені — запити до кожного маршруту та на кожну помилку. Виконуйте їх по черзі згори вниз
  у VS Code з розширенням [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client).
  Ідентифікатори підставляються з відповідей попередніх запитів.
- `npm test` — unit-тести (репозиторії й DataSource замінені моками).
- `npm run test:e2e` — e2e-тести всього HTTP-циклу на окремій базі `<POSTGRES_DB>_test`
  (створюється автоматично, схема — тими самими міграціями). Потрібен запущений `docker compose`.
  Назва бази підмінюється в `test/setup-e2e.ts` ще до імпорту `AppModule`, тож дані розробки тести не чіпають.
- `requests.http` спершу реєструє двох користувачів і входить адміністратором із `.env`
  (змінні `@adminEmail` / `@adminPassword` на початку файлу мають збігатися з `ADMIN_EMAIL` / `ADMIN_PASSWORD`),
  далі бере токени з відповідей і для кожної групи маршрутів перевіряє `401` без токена та `403` з роллю `user`.

## Схема БД

```
films 1 ──< showings >── 1 halls        (FK обов'язкові, без каскаду: 409 на видалення)
              │
              1
              ▼
users 1 ──< bookings 1 ──< booking_seats  (ON DELETE CASCADE)
  │                        UNIQUE (showing_id, row, seat)
  1
  └──< refresh_tokens      (ON DELETE CASCADE, UNIQUE token_hash)
```

- `id` усіх таблиць — `uuid DEFAULT gen_random_uuid()` (`uuidExtension: 'pgcrypto'`).
- Час — `timestamptz`, ціни — `integer` у копійках.
- `users.email` унікальний; `users.role` — `varchar` з `CHECK (role IN ('user', 'admin'))`, `DEFAULT 'user'`.
- `bookings.user_id` обов'язковий. Міграція `AddUsersAndRefreshTokens` перед додаванням колонки **видаляє наявні бронювання**
  (база розробки, власника в них немає); `down` відкочує схему, але видалені бронювання не повертає.
- Перелік місць залу в БД не зберігається — обчислюється з `rows × seats_per_row`.
- `booking_seats.showing_id` навмисно дублює `bookings.showing_id`: унікальний індекс будується
  по колонках однієї таблиці, тож БД сама не дасть продати місце двічі навіть при одночасних запитах.

## Структура

```
src/
├── films/        фільми
├── halls/        зали й обчислення переліку місць
├── showings/     сеанси, пагінація розкладу (Query Builder)
├── bookings/     бронювання (транзакція), зайнятість місць, перевірка власника
├── users/        користувачі й ролі (сутність, сервіс без HTTP)
├── auth/         реєстрація, вхід, refresh/logout, JwtAuthGuard, RolesGuard
├── common/       фільтр винятків, помилки БД, декоратори @Public / @Roles / @CurrentUser
├── types/        розширення Request з express (request.user)
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
  - `APP_FILTER` — `HttpExceptionFilter`: єдиний формат помилки (статус, час, шлях, повідомлення);
  - `APP_INTERCEPTOR` — `ClassSerializerInterceptor`: застосовує `@Exclude()` (прибирає `passwordHash`);
  - `APP_GUARD` (в `AuthModule`, де доступний `JwtService`) — `JwtAuthGuard`, потім `RolesGuard`.
- Сервіси пишуть попередження через вбудований `Logger` (не знайдено, конфлікт), фільтр — підсумок `METHOD url -> status`.

## Маршрути

Доступ: **—** без токена; **auth** — будь-який авторизований (без токена → `401`);
**admin** — лише адміністратор (без токена → `401`, роль `user` → `403`).

| Метод    | Шлях                                                         | Доступ | Опис                                                                             |
| -------- | ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| `POST`   | `/auth/register`                                             | —      | Реєстрація (`email`, `password` ≥ 8) → `201` без пароля; `409` пошта зайнята     |
| `POST`   | `/auth/login`                                                | —      | Вхід → `200` `{ accessToken, refreshToken }`; `401` однаковий для пошти й пароля |
| `POST`   | `/auth/refresh`                                              | —      | Тіло `{ refreshToken }` → нова пара, старий токен недійсний; `401`               |
| `POST`   | `/auth/logout`                                               | auth   | Тіло `{ refreshToken }` → `204`; `404`, якщо токен не існує або чужий            |
| `GET`    | `/auth/me`                                                   | auth   | `{ id, email, role }`                                                            |
| `POST`   | `/films`                                                     | admin  | Створити фільм                                                                   |
| `GET`    | `/films`                                                     | —      | Усі фільми                                                                       |
| `GET`    | `/films/:id`                                                 | —      | Один фільм                                                                       |
| `PATCH`  | `/films/:id`                                                 | admin  | Оновити фільм                                                                    |
| `DELETE` | `/films/:id`                                                 | admin  | Видалити фільм (`409`, якщо є сеанси)                                            |
| `POST`   | `/halls`                                                     | admin  | Створити зал (назва унікальна, без урахування регістру)                          |
| `GET`    | `/halls`                                                     | —      | Усі зали                                                                         |
| `GET`    | `/halls/:id`                                                 | —      | Зал із переліком місць                                                           |
| `DELETE` | `/halls/:id`                                                 | admin  | Видалити зал (`409`, якщо є сеанси)                                              |
| `POST`   | `/showings`                                                  | admin  | Створити сеанс                                                                   |
| `GET`    | `/showings?filmId=&date=YYYY-MM-DD&page=1&limit=20&sort=asc` | —      | Сторінка розкладу з фільтрами: `{ items, total, page, limit }`                   |
| `GET`    | `/showings/:id`                                              | —      | Один сеанс                                                                       |
| `GET`    | `/showings/:id/seats`                                        | —      | Місця залу з ознакою `isBooked`                                                  |
| `POST`   | `/showings/:id/bookings`                                     | auth   | Забронювати місця на користувача з токена (`userId` з тіла не приймається)       |
| `GET`    | `/showings/:id/bookings`                                     | admin  | Бронювання сеансу                                                                |
| `GET`    | `/bookings`                                                  | admin  | Усі бронювання                                                                   |
| `GET`    | `/bookings/my`                                               | auth   | Мої бронювання з даними сеансу                                                   |
| `DELETE` | `/bookings/:id`                                              | auth   | Скасувати своє бронювання (admin — будь-яке); `403` чуже, `404` немає            |

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
