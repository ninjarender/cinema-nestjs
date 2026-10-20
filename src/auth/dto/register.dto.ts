import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Поля role тут немає: whitelist відкине його, тож роль із тіла ігнорується. */
export class RegisterDto {
  @ApiProperty({ example: 'olena@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255) // довжина колонки
  email: string;

  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72) // bcrypt враховує лише перші 72 БАЙТИ (кирилиця — 2 байти на символ)
  password: string;
}
