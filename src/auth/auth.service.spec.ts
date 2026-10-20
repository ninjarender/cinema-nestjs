import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { UserRole } from '../users/user-role.enum.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findByEmail: vi.fn(),
    findByIdOrFail: vi.fn(),
    create: vi.fn(),
  };
  const refreshTokensService = { issue: vi.fn(), rotate: vi.fn() };
  const jwtService = { signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    usersService.create.mockImplementation(async (dto: object) => ({
      id: 'user-1',
      role: UserRole.User,
      ...dto,
    }));
    refreshTokensService.issue.mockResolvedValue('refresh-1');
    jwtService.signAsync.mockResolvedValue('access-1');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RefreshTokensService, useValue: refreshTokensService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('зберігає bcrypt-хеш, а не пароль', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await service.register({ email: 'a@b.ua', password: 'password-1' });

    const { passwordHash } = usersService.create.mock.calls[0][0] as {
      passwordHash: string;
    };
    expect(passwordHash).not.toBe('password-1');
    expect(await bcrypt.compare('password-1', passwordHash)).toBe(true);
  });

  it('повторна пошта → 409', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.register({ email: 'a@b.ua', password: 'password-1' }),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('вхід видає пару токенів з sub і role у payload', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      role: UserRole.Admin,
      passwordHash: await bcrypt.hash('password-1', 4),
    });

    await expect(
      service.login({ email: 'a@b.ua', password: 'password-1' }),
    ).resolves.toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      role: UserRole.Admin,
    });
  });

  it('однакове повідомлення для неіснуючої пошти й неправильного пароля', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    const noUser = await service
      .login({ email: 'x@b.ua', password: 'password-1' })
      .catch((e: unknown) => e);

    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      passwordHash: await bcrypt.hash('password-1', 4),
    });
    const wrongPassword = await service
      .login({ email: 'a@b.ua', password: 'wrong-password' })
      .catch((e: unknown) => e);

    expect(noUser).toBeInstanceOf(UnauthorizedException);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect((noUser as Error).message).toBe((wrongPassword as Error).message);
  });

  it('refresh підписує access з актуальною роллю з БД', async () => {
    refreshTokensService.rotate.mockResolvedValue({
      userId: 'user-1',
      token: 'refresh-2',
    });
    usersService.findByIdOrFail.mockResolvedValue({
      id: 'user-1',
      role: UserRole.Admin,
    });

    await expect(service.refresh('refresh-1')).resolves.toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-2',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      role: UserRole.Admin,
    });
  });
});
