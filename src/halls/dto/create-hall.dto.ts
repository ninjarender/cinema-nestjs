import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateHallDto {
  @ApiProperty({ example: 'Зал 1' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // дублює length колонки → 400, а не помилка PG
  name: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 100 })
  @IsInt()
  @IsPositive()
  @Max(100)
  rows: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 100 })
  @IsInt()
  @IsPositive()
  @Max(100)
  seatsPerRow: number;
}
