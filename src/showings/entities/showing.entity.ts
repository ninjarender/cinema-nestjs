import { ApiProperty } from '@nestjs/swagger';

export class Showing {
  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  id: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  filmId: string;

  @ApiProperty({ example: '9c1b6e2a-5f3d-4a71-9b6c-2d84f0a1c7e5' })
  hallId: string;

  @ApiProperty({
    example: '2026-11-20T18:30:00.000Z',
    description: 'Початок сеансу, ISO 8601 в UTC',
  })
  startsAt: string;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;
}

/** Сеанс у відповідях на читання: назви фільму й залу замість ідентифікаторів. */
export class ShowingView {
  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  filmTitle: string;

  @ApiProperty({ example: 'Зал 1' })
  hallName: string;

  @ApiProperty({ example: '2026-11-20T18:30:00.000Z' })
  startsAt: string;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;
}
