import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity.js';
import { Film } from '../../films/entities/film.entity.js';
import { Hall } from '../../halls/entities/hall.entity.js';

@Entity('showings')
export class Showing {
  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // FK-колонки описані явно: контракт API (ДЗ_1) повертає filmId і hallId
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ name: 'film_id', type: 'uuid' })
  filmId: string;

  @ApiProperty({ example: '9c1b6e2a-5f3d-4a71-9b6c-2d84f0a1c7e5' })
  @Column({ name: 'hall_id', type: 'uuid' })
  hallId: string;

  @ApiProperty({
    example: '2026-11-20T18:30:00.000Z',
    description: 'Початок сеансу, ISO 8601 в UTC',
  })
  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  @Column({ type: 'integer' })
  price: number;

  // onDelete не задано → RESTRICT: фільм чи зал із сеансами БД не видалить
  @ManyToOne(() => Film, (film) => film.showings, { nullable: false })
  @JoinColumn({ name: 'film_id' })
  film?: Relation<Film>;

  @ManyToOne(() => Hall, (hall) => hall.showings, { nullable: false })
  @JoinColumn({ name: 'hall_id' })
  hall?: Relation<Hall>;

  @OneToMany(() => Booking, (booking) => booking.showing)
  bookings?: Booking[];
}
