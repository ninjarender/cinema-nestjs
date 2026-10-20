import { fakerUK as faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from 'typeorm';
import { BookingSeat } from './bookings/entities/booking-seat.entity.js';
import { Booking } from './bookings/entities/booking.entity.js';
import { validate } from './config/environment-variables.js';
import dataSource from './data-source.js';
import { Film } from './films/entities/film.entity.js';
import { Hall } from './halls/entities/hall.entity.js';
import { Showing } from './showings/entities/showing.entity.js';
import { User } from './users/entities/user.entity.js';
import { UserRole } from './users/user-role.enum.js';

/**
 * Засівання БД: `npm run seed` (після `npm run migration:run`).
 *
 * Дані генерує faker з фіксованим seed, тож кожен запуск дає ті самі записи
 * з тими самими id. Вставка йде через INSERT … ON CONFLICT DO NOTHING,
 * тому повторний запуск нічого не дублює.
 * ⚠️ Версія @faker-js/faker закріплена точно: інша версія з тим самим seed дає інші дані.
 *
 * Перший адміністратор береться зі змінних ADMIN_EMAIL і ADMIN_PASSWORD (валідація
 * та сама, що й у застосунку). Засіяні бронювання належать йому.
 */

const FAKER_SEED = 20261125;
const FILMS_COUNT = 4;
const HALLS_COUNT = 2;
const SHOWINGS_COUNT = 8;
const BOOKINGS_COUNT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const START_HOURS = [10, 13, 16, 19, 21];

faker.seed(FAKER_SEED);

// Той самий клас валідації, що й у ConfigModule: без ADMIN_* seed не запуститься
const env = validate(process.env);

/** Сеанс через `days` діб від сьогодні о годині `hour` UTC — завжди в майбутньому. */
function daysFromNow(days: number, hour: number): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

const films: Film[] = Array.from({ length: FILMS_COUNT }, () => ({
  id: faker.string.uuid(),
  title: faker.book.title(),
  durationMinutes: faker.number.int({ min: 75, max: 180 }),
  releaseYear: faker.number.int({ min: 1930, max: 2026 }),
}));

// Назви залів унікальні (unique-індекс у БД)
const halls: Hall[] = faker.helpers
  .uniqueArray(() => `Зал «${faker.location.city()}»`, HALLS_COUNT)
  .map((name) => ({
    id: faker.string.uuid(),
    name,
    rows: faker.number.int({ min: 4, max: 12 }),
    seatsPerRow: faker.number.int({ min: 6, max: 16 }),
  }));

// Кожен сеанс — у свою добу; перші сеанси гарантовано покривають усі фільми й зали
const showings: Showing[] = Array.from({ length: SHOWINGS_COUNT }, (_, i) => ({
  id: faker.string.uuid(),
  filmId: films[i % films.length].id,
  hallId: halls[i % halls.length].id,
  startsAt: daysFromNow(i + 1, faker.helpers.arrayElement(START_HOURS)),
  price: faker.number.int({ min: 80, max: 250 }) * 100, // у копійках
}));

const bookings: Omit<Booking, 'userId'>[] = []; // власник — адміністратор, id відомий лише після вставки
const bookingSeats: Partial<BookingSeat>[] = [];
const takenSeats = new Set<string>(); // одне місце на сеансі — один раз

for (let i = 0; i < BOOKINGS_COUNT; i++) {
  const showing = showings[i % showings.length];
  const hall = halls.find(({ id }) => id === showing.hallId)!;
  const bookingId = faker.string.uuid();

  const seats = faker.helpers.uniqueArray(
    () => ({
      row: faker.number.int({ min: 1, max: hall.rows }),
      seat: faker.number.int({ min: 1, max: hall.seatsPerRow }),
    }),
    faker.number.int({ min: 1, max: 4 }),
  );
  const freeSeats = seats.filter(({ row, seat }) => {
    const key = `${showing.id}:${row}:${seat}`;
    if (takenSeats.has(key)) return false;
    takenSeats.add(key);
    return true;
  });

  bookings.push({
    id: bookingId,
    showingId: showing.id,
    totalPrice: showing.price * freeSeats.length,
  } as Omit<Booking, 'userId'>);
  bookingSeats.push(
    ...freeSeats.map(({ row, seat }) => ({
      id: faker.string.uuid(),
      bookingId,
      showingId: showing.id,
      row,
      seat,
    })),
  );
}

/** INSERT … ON CONFLICT DO NOTHING; повертає кількість реально вставлених рядків. */
async function insertMissing<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  values: Partial<T>[],
): Promise<number> {
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(entity)
    .values(values as never)
    .orIgnore()
    .returning('id')
    .execute();
  return (result.raw as unknown[]).length;
}

/**
 * Створює адміністратора; якщо користувач з цією поштою вже є — робить його admin
 * і ставить пароль з ADMIN_PASSWORD (INSERT … ON CONFLICT (email) DO UPDATE).
 * Так обліковий запис, зареєстрований кимось на цю пошту, не стає адміністратором зі своїм паролем.
 * Повертає id адміністратора.
 */
async function upsertAdmin(manager: EntityManager): Promise<string> {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      email: env.ADMIN_EMAIL.trim().toLowerCase(), // як RegisterDto / LoginDto
      passwordHash,
      role: UserRole.Admin,
    })
    .orUpdate(['role', 'password_hash'], ['email'])
    .returning('id')
    .execute();
  return (result.raw as { id: string }[])[0].id;
}

async function seed(source: DataSource): Promise<void> {
  await source.initialize();
  try {
    // Одна транзакція: або засіяно все, або нічого
    const inserted = await source.transaction(async (manager) => {
      const adminId = await upsertAdmin(manager);
      return {
        films: await insertMissing(manager, Film, films),
        halls: await insertMissing(manager, Hall, halls),
        showings: await insertMissing(manager, Showing, showings),
        bookings: await insertMissing(
          manager,
          Booking,
          bookings.map((booking) => ({ ...booking, userId: adminId })),
        ),
        bookingSeats: await insertMissing(manager, BookingSeat, bookingSeats),
      };
    });
    console.log(`Адміністратор: ${env.ADMIN_EMAIL}`); // пошта, але не пароль
    console.log('Seed завершено, додано рядків:', inserted);
  } finally {
    await source.destroy();
  }
}

await seed(dataSource);
