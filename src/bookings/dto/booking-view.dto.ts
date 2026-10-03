import { ApiProperty } from '@nestjs/swagger';
import { Seat } from '../../halls/dto/hall-with-seats.dto.js';

/** Бронювання у відповідях API: місця — масив { row, seat }, як у ДЗ_1. */
export class BookingView {
  @ApiProperty({ example: 'b8a33983-26a4-4299-86f5-de276484c9b4' })
  id: string;

  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  showingId: string;

  @ApiProperty({ type: [Seat] })
  seats: Seat[];

  @ApiProperty({
    example: 25000,
    description: 'Ціна сеансу × кількість місць, у копійках',
  })
  totalPrice: number;

  @ApiProperty({ example: '2026-11-20T12:00:00.000Z' })
  createdAt: Date;
}

export class SeatAvailability extends Seat {
  @ApiProperty({ example: false })
  isBooked: boolean;
}
