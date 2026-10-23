import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { BookingSeat } from './booking-seat.entity.js';

@Entity('bookings')
export class Booking {
  @ApiProperty({ example: 'b8a33983-26a4-4299-86f5-de276484c9b4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  @Column({ name: 'showing_id', type: 'uuid' })
  showingId: string;

  // Колонка власника: перевірка «своє чи чуже» без завантаження User
  @ApiProperty({ example: 'f2b1c9e4-3a7d-4e8b-9c1f-5d6a7b8c9d0e' })
  @Index() // GET /bookings/my фільтрує за власником
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ApiProperty({
    example: 25000,
    description: 'Ціна сеансу × кількість місць, у копійках',
  })
  @Column({ name: 'total_price', type: 'integer' })
  totalPrice: number;

  @ApiProperty({ example: '2026-11-20T12:00:00.000Z' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Showing, (showing) => showing.bookings, { nullable: false })
  @JoinColumn({ name: 'showing_id' })
  showing?: Relation<Showing>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @OneToMany(() => BookingSeat, (seat) => seat.booking)
  seats?: BookingSeat[];
}
