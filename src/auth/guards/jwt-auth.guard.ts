import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/** Глобальний guard: «закрито за замовчуванням», відкрито лише через @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // метод має пріоритет над класом
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (token === null) {
      throw new UnauthorizedException('Потрібна автентифікація');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token); // підпис + exp
    } catch {
      throw new UnauthorizedException('Токен недійсний або застарілий');
    }
    return true; // у БД НЕ ходимо — у цьому сенс токена
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }
}
