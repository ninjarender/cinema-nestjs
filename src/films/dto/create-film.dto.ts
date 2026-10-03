import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFilmDto {
  @ApiProperty({ example: 'Тіні забутих предків' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // дублює length колонки → 400, а не помилка PG
  title: string;

  @ApiProperty({
    example: 97,
    description: 'Тривалість у хвилинах, ціле додатне число',
  })
  @IsInt()
  @IsPositive()
  durationMinutes: number;

  @ApiProperty({ example: 1965, minimum: 1888, maximum: 2100 })
  @IsInt()
  @Min(1888)
  @Max(2100)
  releaseYear: number;
}
