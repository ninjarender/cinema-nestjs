import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../users/user-role.enum.js';

/** Виконується ПІСЛЯ JwtAuthGuard: читає роль із уже заповненого request.user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined) return true; // без @Roles — обмежень за роллю немає

    const request = context.switchToHttp().getRequest<Request>();
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException('Недостатньо прав');
    }
    return true;
  }
}
