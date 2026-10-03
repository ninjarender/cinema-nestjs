import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';
import { Booking } from './booking.entity.js';

/**
 * Одне заброньоване місце — один рядок.
 * showingId дублюється (його можна дістати через booking), бо унікальний індекс
 * будується лише по колонках однієї таблиці: так БД сама не дає продати місце двічі.
 */
@Entity('booking_seats')
@Index(['showingId', 'row', 'seat'], { unique: true })
export class BookingSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'showing_id', type: 'uuid' })
  showingId: string;

  @Column({ type: 'integer' })
  row: number;

  @Column({ type: 'integer' })
  seat: number;

  @ManyToOne(() => Booking, (booking) => booking.seats, {
    nullable: false,
    onDelete: 'CASCADE', // видалення бронювання видаляє його місця на рівні БД
  })
  @JoinColumn({ name: 'booking_id' })
  booking?: Relation<Booking>;

  @ManyToOne(() => Showing, { nullable: false })
  @JoinColumn({ name: 'showing_id' })
  showing?: Relation<Showing>;
}
