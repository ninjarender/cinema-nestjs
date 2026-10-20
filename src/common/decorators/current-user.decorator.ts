import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface.js';

/** Дані з access-токена, які JwtAuthGuard поклав у request.user. */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    return data ? request.user[data] : request.user; // keyof — помилку в назві поля покаже компілятор
  },
);
