import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user-role.enum.js';
import { RolesGuard } from './roles.guard.js';

function contextAs(role: UserRole): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'user-1', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  it('пропускає маршрут без @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextAs(UserRole.User))).toBe(true);
  });

  it('пропускає адміністратора на @Roles(admin)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.Admin]);
    expect(guard.canActivate(contextAs(UserRole.Admin))).toBe(true);
  });

  it('403 для ролі user на @Roles(admin)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.Admin]);
    expect(() => guard.canActivate(contextAs(UserRole.User))).toThrow(
      ForbiddenException,
    );
  });
});
