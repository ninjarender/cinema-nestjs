import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class FindShowingsQueryDto {
  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Залишає сеанси лише цього фільму',
  })
  @IsOptional()
  @IsString()
  filmId?: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description:
      'Залишає сеанси, що починаються цієї доби (UTC), формат YYYY-MM-DD',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    { message: 'date must be a valid calendar date' },
  )
  date?: string;
}
