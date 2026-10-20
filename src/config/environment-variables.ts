import { plainToInstance } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // Параметри підключення до PostgreSQL: без них застосунок не стартує
  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  POSTGRES_PORT: number;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  // Автентифікація
  @IsString()
  @MinLength(32) // короткий секрет підпису легко підібрати перебором
  JWT_SECRET: string;

  // Access-токен не відкликати, тому живе хвилини
  @IsInt()
  @Min(1)
  @Max(60)
  ACCESS_TOKEN_TTL_MINUTES: number;

  // Refresh-токен лежить у БД і відкликається, тому може жити дні
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS: number;

  // Перший адміністратор, якого створює `npm run seed`
  @IsEmail()
  ADMIN_EMAIL: string;

  @IsString()
  @MinLength(8) // ті самі вимоги, що й до пароля при реєстрації
  @IsByteLength(0, 72)
  ADMIN_PASSWORD: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
