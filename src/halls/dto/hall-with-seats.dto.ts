import { ApiProperty } from '@nestjs/swagger';
import { Hall } from '../entities/hall.entity.js';

export class Seat {
  @ApiProperty({ example: 1 })
  row: number;

  @ApiProperty({ example: 4 })
  seat: number;
}

/** Перелік місць не зберігається в БД — обчислюється з rows × seatsPerRow. */
export class HallWithSeats extends Hall {
  @ApiProperty({
    type: [Seat],
    description: 'Усі місця залу, rows × seatsPerRow',
  })
  seats: Seat[];
}
