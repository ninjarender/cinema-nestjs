import { ApiProperty } from '@nestjs/swagger';

export class Hall {
  @ApiProperty({ example: '9c1b6e2a-5f3d-4a71-9b6c-2d84f0a1c7e5' })
  id: string;

  @ApiProperty({ example: 'Зал 1', description: 'Унікальна серед усіх залів' })
  name: string;

  @ApiProperty({ example: 3 })
  rows: number;

  @ApiProperty({ example: 5 })
  seatsPerRow: number;
}

export class Seat {
  @ApiProperty({ example: 1 })
  row: number;

  @ApiProperty({ example: 4 })
  seat: number;
}

export class HallWithSeats extends Hall {
  @ApiProperty({
    type: [Seat],
    description: 'Усі місця залу, rows × seatsPerRow',
  })
  seats: Seat[];
}
