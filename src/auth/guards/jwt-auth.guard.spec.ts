import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../users/user-role.enum.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'test-secret-test-secret-test-secret';

function contextWith(
  authorization: string | undefined,
  request: Record<string, unknown> = {},
): ExecutionContext {
  Object.assign(request, { headers: { authorization } });
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: SECRET });
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new JwtAuthGuard(reflector as unknown as Reflector, jwtService);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
  });

  it('пропускає маршрут з @Public() без токена', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextWith(undefined))).resolves.toBe(true);
  });

  it('кладе payload у request.user для дійсного Bearer-токена', async () => {
    const token = await jwtService.signAsync({
      sub: 'user-1',
      role: UserRole.User,
    });
    const request: Record<string, unknown> = {};

    await guard.canActivate(contextWith(`Bearer ${token}`, request));

    expect(request.user).toMatchObject({ sub: 'user-1', role: UserRole.User });
  });

  it.each([
    ['без заголовка', undefined],
    ['інша схема', 'Basic abc'],
    ['Bearer без токена', 'Bearer '],
    ['зіпсований токен', 'Bearer not.a.jwt'],
  ])('401: %s', async (_case, header) => {
    await expect(guard.canActivate(contextWith(header))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('401 на токен з чужим підписом', async () => {
    const forged = await new JwtService({ secret: 'other' }).signAsync({
      sub: 'user-1',
      role: UserRole.Admin,
    });
    await expect(
      guard.canActivate(contextWith(`Bearer ${forged}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('401 на прострочений токен', async () => {
    const expired = await jwtService.signAsync(
      { sub: 'user-1', role: UserRole.User },
      { expiresIn: -10 },
    );
    await expect(
      guard.canActivate(contextWith(`Bearer ${expired}`)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
