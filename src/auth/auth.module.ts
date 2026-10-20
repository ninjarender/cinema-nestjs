import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../config/environment-variables.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }), // і підпис, і перевірка
        signOptions: {
          // у секундах; змінна задається в хвилинах
          expiresIn:
            config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }) * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensService,
    // Глобально; реєструємо тут, де доступний JwtService. ПОРЯДОК = порядок виконання:
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // спершу заповнює request.user
    { provide: APP_GUARD, useClass: RolesGuard }, // потім читає з нього role
  ],
})
export class AuthModule {}
