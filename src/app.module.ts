import {
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import {
  EnvironmentVariables,
  validate,
} from './config/environment-variables.js';
import { FilmsModule } from './films/films.module.js';
import { HallsModule } from './halls/halls.module.js';
import { ShowingsModule } from './showings/showings.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres',
        uuidExtension: 'pgcrypto',
        host: config.get('POSTGRES_HOST', { infer: true }),
        port: config.get('POSTGRES_PORT', { infer: true }),
        username: config.get('POSTGRES_USER', { infer: true }),
        password: config.get('POSTGRES_PASSWORD', { infer: true }),
        database: config.get('POSTGRES_DB', { infer: true }),
        autoLoadEntities: true,
        synchronize: false, // схема — лише міграціями
      }),
    }),
    FilmsModule,
    HallsModule,
    ShowingsModule,
    BookingsModule,
    UsersModule,
    AuthModule, // глобальні JwtAuthGuard і RolesGuard реєструються в ньому
  ],
  providers: [
    // Глобальні складові зареєстровані провайдерами, а не в main.ts,
    // тому тестовий застосунок отримує їх разом із модулем (тема 13).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // поля, яких немає в DTO, до сервісу не потрапляють
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // @Exclude (passwordHash) працює лише через instanceToPlain, тобто цей interceptor
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
