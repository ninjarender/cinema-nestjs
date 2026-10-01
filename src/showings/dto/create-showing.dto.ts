import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateShowingDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  filmId: string;

  @ApiProperty({ example: '9c1b6e2a-5f3d-4a71-9b6c-2d84f0a1c7e5' })
  @IsUUID()
  hallId: string;

  @ApiProperty({
    example: '2026-11-20T18:30:00Z',
    description: 'Дата й час початку в ISO 8601, у майбутньому',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt: string;

  @ApiProperty({
    example: 12500,
    description: 'Ціна квитка в копійках, ціле додатне',
  })
  @IsInt()
  @IsPositive()
  price: number;
}
