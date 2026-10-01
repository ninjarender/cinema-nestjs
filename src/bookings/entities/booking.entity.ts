import { ApiProperty } from '@nestjs/swagger';
import { Seat } from '../../halls/entities/hall.entity.js';

export class Booking {
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
}

export class SeatAvailability extends Seat {
  @ApiProperty({ example: false })
  isBooked: boolean;
}
