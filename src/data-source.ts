import 'dotenv/config'; // .env → process.env ще до створення DataSource
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { BookingSeat } from './bookings/entities/booking-seat.entity.js';
import { Booking } from './bookings/entities/booking.entity.js';
import { Film } from './films/entities/film.entity.js';
import { Hall } from './halls/entities/hall.entity.js';
import { Showing } from './showings/entities/showing.entity.js';

/**
 * DataSource для CLI TypeORM і seed-скрипта: вони працюють поза NestJS,
 * тому ConfigService і autoLoadEntities їм недоступні. Застосунок цей файл не імпортує.
 *
 * Проєкт зібраний як ESM, тож CLI запускається над скомпільованим dist/
 * (див. скрипти typeorm і migration:* у package.json).
 */
export default new DataSource({
  type: 'postgres',
  uuidExtension: 'pgcrypto',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT), // рядок → число вручну: тут немає валідованого ConfigService
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [Film, Hall, Showing, Booking, BookingSeat], // явно: autoLoadEntities — фіча NestJS
  migrations: [fileURLToPath(new URL('./migrations/*.js', import.meta.url))],
});
