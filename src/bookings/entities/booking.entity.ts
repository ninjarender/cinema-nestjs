import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';
import { BookingSeat } from './booking-seat.entity.js';

@Entity('bookings')
export class Booking {
  @ApiProperty({ example: 'b8a33983-26a4-4299-86f5-de276484c9b4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  @Column({ name: 'showing_id', type: 'uuid' })
  showingId: string;

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

  @OneToMany(() => BookingSeat, (seat) => seat.booking)
  seats?: BookingSeat[];
}
