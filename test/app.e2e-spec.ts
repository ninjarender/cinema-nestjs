/// <reference types="vite/client" />
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';

// POSTGRES_DB уже замінено на <db>_test у test/setup-e2e.ts

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

const ADMIN = { email: 'admin@cinema.test', password: 'admin-password' };
const USER = { email: 'olena@cinema.test', password: 'olena-password' };
const OTHER = { email: 'taras@cinema.test', password: 'taras-password' };

describe('Cinema API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let userToken: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const asAdmin = () => bearer(adminToken);
  const asUser = () => bearer(userToken);

  async function login(credentials: { email: string; password: string }) {
    const res = await http.post('/auth/login').send(credentials).expect(200);
    return res.body as { accessToken: string; refreshToken: string };
  }

  async function registerAndLogin(credentials: {
    email: string;
    password: string;
  }) {
    await http.post('/auth/register').send(credentials).expect(201);
    return login(credentials);
  }

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
    const db = app.get(DataSource);
    await db.query(
      'TRUNCATE booking_seats, bookings, showings, films, halls, refresh_tokens, users',
    );

    // Адміністратора через API не створити (роль із тіла ігнорується) — лише напряму в БД, як seed
    await db.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
      [ADMIN.email, await bcrypt.hash(ADMIN.password, 4)],
    );
    adminToken = (await login(ADMIN)).accessToken;
    userToken = (await registerAndLogin(USER)).accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  async function createFilm(title = 'Тіні забутих предків') {
    const res = await http
      .post('/films')
      .set(asAdmin())
      .send({ title, durationMinutes: 97, releaseYear: 1965 })
      .expect(201);
    return res.body.id as string;
  }

  async function createHall(name = 'Зал 1', rows = 3, seatsPerRow = 5) {
    const res = await http
      .post('/halls')
      .set(asAdmin())
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
      .set(asAdmin())
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
        .set(asAdmin())
        .send({ durationMinutes: 98, unknownField: 'stripped' })
        .expect(200);
      expect(updated.body).toEqual({
        id,
        title: 'Тіні забутих предків',
        durationMinutes: 98,
        releaseYear: 1965,
      });

      await http.delete(`/films/${id}`).set(asAdmin()).expect(204);
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
        .set(asAdmin())
        .send({ title: 'X', releaseYear: 2000 })
        .expect(400);
      await http
        .post('/films')
        .set(asAdmin())
        .send({ title: 'X', durationMinutes: '97', releaseYear: 2000 })
        .expect(400);
    });

    it('returns 409 when a showing references the film', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      await createShowing(filmId, hallId);

      await http.delete(`/films/${filmId}`).set(asAdmin()).expect(409);
      await http.delete(`/halls/${hallId}`).set(asAdmin()).expect(409);
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
        .set(asAdmin())
        .send({ name: 'Зал 1', rows: 1, seatsPerRow: 1 })
        .expect(409);
    });

    it('rejects non-positive and non-integer sizes', async () => {
      await http
        .post('/halls')
        .set(asAdmin())
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
        .set(asAdmin())
        .send({ ...base, filmId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .set(asAdmin())
        .send({ ...base, hallId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .set(asAdmin())
        .send({ ...base, startsAt: 'not-a-date' })
        .expect(400);
      await http
        .post('/showings')
        .set(asAdmin())
        .send({ ...base, startsAt: '2020-01-01T10:00:00Z' })
        .expect(400);
      await http
        .post('/showings')
        .set(asAdmin())
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
        .set(asUser())
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
        .set(asUser())
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
      const all = await http.get('/bookings').set(asAdmin()).expect(200);
      expect(all.body).toHaveLength(1);

      await http
        .delete(`/bookings/${booking.body.id}`)
        .set(asUser())
        .expect(204);
      expect(await booked()).toBe(0);
      await http
        .delete(`/bookings/${booking.body.id}`)
        .set(asUser())
        .expect(404);
    });

    it('sells a seat only once under concurrent requests', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = () =>
        http
          .post(`/showings/${showingId}/bookings`)
          .set(asUser())
          .send({ seats: [{ row: 2, seat: 2 }] });

      const statuses = (await Promise.all([book(), book(), book()]))
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);

      const bookings = await http
        .get(`/showings/${showingId}/bookings`)
        .set(asAdmin())
        .expect(200);
      expect(bookings.body).toHaveLength(1);
    });

    it('rejects invalid seat lists', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = (seats: unknown) =>
        http
          .post(`/showings/${showingId}/bookings`)
          .set(asUser())
          .send({ seats });

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
        .set(asUser())
        .send({ seats: [{ row: 1, seat: 1 }] })
        .expect(404);
    });
  });

  describe('auth', () => {
    it('registers without exposing the password hash and ignores the role', async () => {
      const res = await http
        .post('/auth/register')
        .send({ ...OTHER, role: 'admin' })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: OTHER.email,
        role: 'user',
        createdAt: expect.any(String),
      });
      expect(JSON.stringify(res.body)).not.toContain('password');

      await http.post('/auth/register').send(OTHER).expect(409);
      await http
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'long-enough' })
        .expect(400);
      await http
        .post('/auth/register')
        .send({ email: 'short@cinema.test', password: '1234567' })
        .expect(400);
      // bcrypt бере лише 72 байти: 40 кириличних символів = 80 байтів → 400
      await http
        .post('/auth/register')
        .send({ email: 'long@cinema.test', password: 'п'.repeat(40) })
        .expect(400);
    });

    it('returns the same 401 for an unknown email and a wrong password', async () => {
      const unknown = await http
        .post('/auth/login')
        .send({ email: 'nobody@cinema.test', password: USER.password })
        .expect(401);
      const wrong = await http
        .post('/auth/login')
        .send({ email: USER.email, password: 'wrong-password' })
        .expect(401);
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('returns the current user', async () => {
      const res = await http.get('/auth/me').set(asUser()).expect(200);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: USER.email,
        role: 'user',
      });
    });

    it('rejects a missing, malformed or forged access token', async () => {
      await http.get('/auth/me').expect(401);
      await http.get('/auth/me').set('Authorization', adminToken).expect(401);
      await http
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
      const [header, , signature] = adminToken.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: MISSING_ID, role: 'admin' }),
      ).toString('base64url');
      await http
        .get('/auth/me')
        .set(bearer(`${header}.${forgedPayload}.${signature}`))
        .expect(401);
    });

    it('rotates the refresh token: the old one stops working', async () => {
      const first = await login(USER);

      const res = await http
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      expect(res.body.refreshToken).not.toBe(first.refreshToken);
      await http.get('/auth/me').set(bearer(res.body.accessToken)).expect(200);

      await http
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await http
        .post('/auth/refresh')
        .send({ refreshToken: 'never-issued' })
        .expect(401);

      // у БД лише SHA-256-хеш, не сам токен
      const rows: { token_hash: string }[] = await app
        .get(DataSource)
        .query('SELECT token_hash FROM refresh_tokens');
      expect(rows.map((r) => r.token_hash)).not.toContain(
        res.body.refreshToken,
      );
    });

    it('consumes a refresh token only once under concurrent requests', async () => {
      const { refreshToken } = await login(USER);
      const refresh = () => http.post('/auth/refresh').send({ refreshToken });

      const statuses = (await Promise.all([refresh(), refresh(), refresh()]))
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([200, 401, 401]);
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await login(USER);
      await app
        .get(DataSource)
        .query(
          `UPDATE refresh_tokens SET expires_at = now() - interval '1 second'`,
        );

      await http.post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logout revokes only the current user refresh token', async () => {
      const own = await login(USER);
      const foreign = await registerAndLogin(OTHER);

      await http
        .post('/auth/logout')
        .send({ refreshToken: own.refreshToken })
        .expect(401);
      await http
        .post('/auth/logout')
        .set(bearer(own.accessToken))
        .send({ refreshToken: foreign.refreshToken })
        .expect(404);
      // чужий токен лишився дійсним
      await http
        .post('/auth/refresh')
        .send({ refreshToken: foreign.refreshToken })
        .expect(200);

      await http
        .post('/auth/logout')
        .set(bearer(own.accessToken))
        .send({ refreshToken: own.refreshToken })
        .expect(204);
      await http
        .post('/auth/refresh')
        .send({ refreshToken: own.refreshToken })
        .expect(401);
      await http
        .post('/auth/logout')
        .set(bearer(own.accessToken))
        .send({ refreshToken: own.refreshToken })
        .expect(404);
    });
  });

  describe('access control', () => {
    it('keeps the catalogue public and admin routes closed', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      const showingId = await createShowing(filmId, hallId);

      for (const path of [
        '/films',
        `/films/${filmId}`,
        '/halls',
        `/halls/${hallId}`,
        '/showings',
        `/showings/${showingId}`,
        `/showings/${showingId}/seats`,
      ]) {
        await http.get(path).expect(200);
      }

      const adminOnly = [
        () => http.post('/films').send({}),
        () => http.patch(`/films/${filmId}`).send({}),
        () => http.delete(`/films/${filmId}`),
        () => http.post('/halls').send({}),
        () => http.delete(`/halls/${hallId}`),
        () => http.get('/bookings'),
        () => http.post('/showings').send({}),
        () => http.get(`/showings/${showingId}/bookings`),
      ];
      for (const send of adminOnly) {
        await send().expect(401);
        await send().set(asUser()).expect(403);
      }

      for (const send of [
        () => http.post(`/showings/${showingId}/bookings`).send({}),
        () => http.delete(`/bookings/${MISSING_ID}`),
        () => http.get('/bookings/my'),
        () => http.post('/auth/logout').send({}),
        () => http.get('/auth/me'),
      ]) {
        await send().expect(401);
      }
    });

    it('binds bookings to the token owner and checks ownership on cancel', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const other = await registerAndLogin(OTHER);
      const me = await http.get('/auth/me').set(asUser()).expect(200);

      const booking = await http
        .post(`/showings/${showingId}/bookings`)
        .set(asUser())
        .send({ seats: [{ row: 1, seat: 1 }], userId: MISSING_ID })
        .expect(201);
      expect(booking.body.userId).toBe(me.body.id);

      const mine = await http.get('/bookings/my').set(asUser()).expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].showing).toMatchObject({
        id: showingId,
        filmTitle: 'Тіні забутих предків',
        hallName: 'Зал 1',
      });
      const othersList = await http
        .get('/bookings/my')
        .set(bearer(other.accessToken))
        .expect(200);
      expect(othersList.body).toEqual([]);

      await http
        .delete(`/bookings/${booking.body.id}`)
        .set(bearer(other.accessToken))
        .expect(403);
      await http
        .delete(`/bookings/${booking.body.id}`)
        .set(asAdmin())
        .expect(204);
      await http.delete(`/bookings/${MISSING_ID}`).set(asUser()).expect(404);
    });
  });
});
