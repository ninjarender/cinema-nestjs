import { ApiProperty } from '@nestjs/swagger';

/** Сеанс у відповідях на читання: назви фільму й залу замість ідентифікаторів. */
export class ShowingView {
  @ApiProperty({ example: '7d1f9a3c-8e2b-4f6a-b1d4-3c5e7a9f0b2d' })
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  filmTitle: string;

  @ApiProperty({ example: 'Зал 1' })
  hallName: string;

  @ApiProperty({ example: '2026-11-20T18:30:00.000Z' })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;
}
