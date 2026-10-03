/// <reference types="vite/client" />
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import 'dotenv/config';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';

// e2e працює з окремою базою, щоб не чіпати дані розробки.
// ConfigModule не перезаписує змінні, які вже є в process.env.
process.env.POSTGRES_DB = `${process.env.POSTGRES_DB}_test`;

// Класи міграцій напряму з src/ (CLI бере їх із dist/)
const migrations = Object.values(
  import.meta.glob<Record<string, Function>>('../src/migrations/*.ts', {
    eager: true,
  }),
).flatMap((module) => Object.values(module));

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function prepareTestDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  const db = process.env.POSTGRES_DB!;
  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [db],
  );
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${db}"`);
  }
  await client.end();

  // Схема — тими самими міграціями, що й у розробці
  const migrator = new DataSource({
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: db,
    migrations,
  });
  await migrator.initialize();
  await migrator.runMigrations();
  await migrator.destroy();
}

describe('Cinema API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    await prepareTestDatabase();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());

    // Кожен тест — з чистого аркуша
    await app
      .get(DataSource)
      .query('TRUNCATE booking_seats, bookings, showings, films, halls');
  });

  afterEach(async () => {
    await app.close();
  });

  async function createFilm(title = 'Тіні забутих предків') {
    const res = await http
      .post('/films')
      .send({ title, durationMinutes: 97, releaseYear: 1965 })
      .expect(201);
    return res.body.id as string;
  }

  async function createHall(name = 'Зал 1', rows = 3, seatsPerRow = 5) {
    const res = await http
      .post('/halls')
      .send({ name, rows, seatsPerRow })
      .expect(201);
    return res.body.id as string;
  }

  async function createShowing(
    filmId: string,
    hallId: string,
    startsAt = tomorrow(),
    price = 12500,
  ) {
    const res = await http
      .post('/showings')
      .send({ filmId, hallId, startsAt, price })
      .expect(201);
    return res.body.id as string;
  }

  describe('films', () => {
    it('creates, reads, updates and deletes a film', async () => {
      const id = await createFilm();

      await http.get(`/films/${id}`).expect(200);
      const updated = await http
        .patch(`/films/${id}`)
        .send({ durationMinutes: 98, unknownField: 'stripped' })
        .expect(200);
      expect(updated.body).toEqual({
        id,
        title: 'Тіні забутих предків',
        durationMinutes: 98,
        releaseYear: 1965,
      });

      await http.delete(`/films/${id}`).expect(204);
      const notFound = await http.get(`/films/${id}`).expect(404);
      // єдиний формат помилки від глобального HttpExceptionFilter
      expect(notFound.body).toEqual({
        statusCode: 404,
        timestamp: expect.any(String),
        path: `/films/${id}`,
        message: `Фільм з id ${id} не знайдено`,
      });
    });

    it('rejects a film with a missing or mistyped field', async () => {
      await http
        .post('/films')
        .send({ title: 'X', releaseYear: 2000 })
        .expect(400);
      await http
        .post('/films')
        .send({ title: 'X', durationMinutes: '97', releaseYear: 2000 })
        .expect(400);
    });

    it('returns 409 when a showing references the film', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      await createShowing(filmId, hallId);

      await http.delete(`/films/${filmId}`).expect(409);
      await http.delete(`/halls/${hallId}`).expect(409);
    });
  });

  describe('halls', () => {
    it('returns the full seat list', async () => {
      const id = await createHall('Зал 1', 3, 5);
      const res = await http.get(`/halls/${id}`).expect(200);
      expect(res.body.seats).toHaveLength(15);
      expect(res.body.seats[0]).toEqual({ row: 1, seat: 1 });
      expect(res.body.seats[14]).toEqual({ row: 3, seat: 5 });
    });

    it('keeps hall names unique', async () => {
      await createHall('Зал 1');
      await http
        .post('/halls')
        .send({ name: 'Зал 1', rows: 1, seatsPerRow: 1 })
        .expect(409);
    });

    it('rejects non-positive and non-integer sizes', async () => {
      await http
        .post('/halls')
        .send({ name: 'X', rows: 2.5, seatsPerRow: 0 })
        .expect(400);
    });
  });

  describe('showings', () => {
    it('validates film, hall, date and price', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      const base = { filmId, hallId, startsAt: tomorrow(), price: 100 };

      await http
        .post('/showings')
        .send({ ...base, filmId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, hallId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, startsAt: 'not-a-date' })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, startsAt: '2020-01-01T10:00:00Z' })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, price: 1.5 })
        .expect(400);
    });

    it('filters by film and date and sorts by start time, then id', async () => {
      const filmA = await createFilm('A');
      const filmB = await createFilm('B');
      const hallId = await createHall();

      await createShowing(filmA, hallId, '2030-05-02T20:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-03T10:00:00Z');
      await createShowing(filmB, hallId, '2030-05-02T12:00:00Z');

      const res = await http
        .get('/showings')
        .query({ filmId: filmA, date: '2030-05-02' })
        .expect(200);

      expect(res.body).toMatchObject({ total: 3, page: 1, limit: 20 });
      const items = res.body.items;
      expect(items.map((s: { startsAt: string }) => s.startsAt)).toEqual([
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T20:00:00.000Z',
      ]);
      expect(items[0].id < items[1].id).toBe(true);
      expect(items[0]).toMatchObject({ filmTitle: 'A', hallName: 'Зал 1' });
      expect(items[0]).not.toHaveProperty('filmId');

      await http.get('/showings').query({ date: '02.05.2030' }).expect(400);
    });

    it('paginates and sorts in the database', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      for (const day of ['01', '02', '03', '04', '05']) {
        await createShowing(filmId, hallId, `2030-06-${day}T10:00:00Z`);
      }

      const page2 = await http
        .get('/showings')
        .query({ page: 2, limit: 2 })
        .expect(200);
      expect(page2.body).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(
        page2.body.items.map((s: { startsAt: string }) => s.startsAt),
      ).toEqual(['2030-06-03T10:00:00.000Z', '2030-06-04T10:00:00.000Z']);

      const desc = await http
        .get('/showings')
        .query({ sort: 'desc', limit: 1 })
        .expect(200);
      expect(desc.body.total).toBe(5);
      expect(desc.body.items).toHaveLength(1);
      expect(desc.body.items[0].startsAt).toBe('2030-06-05T10:00:00.000Z');

      for (const query of [
        { page: 0 },
        { page: 1.5 },
        { limit: 0 },
        { limit: 101 },
        { limit: 'ten' },
        { sort: 'up' },
        { filmId: 'not-a-uuid' },
      ]) {
        await http.get('/showings').query(query).expect(400);
      }
    });
  });

  describe('bookings', () => {
    it('books seats, rejects conflicts atomically and frees seats on cancel', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );

      const booking = await http
        .post(`/showings/${showingId}/bookings`)
        .send({
          seats: [
            { row: 1, seat: 4 },
            { row: 1, seat: 5 },
          ],
        })
        .expect(201);
      expect(booking.body.totalPrice).toBe(25000);

      // одне з місць зайняте → 409 і ряд 2 місце 1 не бронюється
      await http
        .post(`/showings/${showingId}/bookings`)
        .send({
          seats: [
            { row: 2, seat: 1 },
            { row: 1, seat: 5 },
          ],
        })
        .expect(409);

      const booked = async () => {
        const res = await http.get(`/showings/${showingId}/seats`).expect(200);
        expect(res.body).toHaveLength(15);
        return res.body.filter((s: { isBooked: boolean }) => s.isBooked).length;
      };
      expect(await booked()).toBe(2);
      const all = await http.get('/bookings').expect(200);
      expect(all.body).toHaveLength(1);

      await http.delete(`/bookings/${booking.body.id}`).expect(204);
      expect(await booked()).toBe(0);
      await http.delete(`/bookings/${booking.body.id}`).expect(404);
    });

    it('sells a seat only once under concurrent requests', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = () =>
        http
          .post(`/showings/${showingId}/bookings`)
          .send({ seats: [{ row: 2, seat: 2 }] });

      const statuses = (await Promise.all([book(), book(), book()]))
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);

      const bookings = await http
        .get(`/showings/${showingId}/bookings`)
        .expect(200);
      expect(bookings.body).toHaveLength(1);
    });

    it('rejects invalid seat lists', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = (seats: unknown) =>
        http.post(`/showings/${showingId}/bookings`).send({ seats });

      await book([]).expect(400);
      await book([{ row: 1 }]).expect(400);
      await book([
        { row: 1, seat: 1 },
        { row: 1, seat: 1 },
      ]).expect(400);
      await book([{ row: 4, seat: 1 }]).expect(400);
      await book([{ row: 1, seat: 6 }]).expect(400);
      await http
        .post(`/showings/${MISSING_ID}/bookings`)
        .send({ seats: [{ row: 1, seat: 1 }] })
        .expect(404);
    });
  });
});
