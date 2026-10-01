import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('Cinema API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());
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

      expect(res.body).toHaveLength(3);
      expect(res.body.map((s: { startsAt: string }) => s.startsAt)).toEqual([
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T20:00:00.000Z',
      ]);
      expect(res.body[0].id < res.body[1].id).toBe(true);
      expect(res.body[0]).toMatchObject({ filmTitle: 'A', hallName: 'Зал 1' });
      expect(res.body[0]).not.toHaveProperty('filmId');

      await http.get('/showings').query({ date: '02.05.2030' }).expect(400);
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

      await http.delete(`/bookings/${booking.body.id}`).expect(204);
      expect(await booked()).toBe(0);
      await http.delete(`/bookings/${booking.body.id}`).expect(404);
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
