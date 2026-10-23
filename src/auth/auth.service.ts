import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { isUniqueViolation } from '../common/database-errors.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { TokenPair } from './interfaces/token-pair.interface.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

const BCRYPT_ROUNDS = 10; // раунди: повільніше = дорожчий перебір
// Однаковий текст для «немає пошти» і «не той пароль»: не розкриває, які адреси зареєстровані
const INVALID_CREDENTIALS = 'Неправильна пошта або пароль';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    if ((await this.usersService.findByEmail(dto.email)) !== null) {
      throw this.emailTaken(dto.email);
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.usersService.create({ email: dto.email, passwordHash });
    } catch (error) {
      // одночасна реєстрація з тією самою поштою: гарантію дає unique-індекс
      if (isUniqueViolation(error)) {
        throw this.emailTaken(dto.email);
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(email);
    if (user === null) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // параметри хешу (сіль, раунди) беруться зі збереженого рядка
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.issueTokens(user);
  }

  async refresh(token: string): Promise<TokenPair> {
    const { userId, token: refreshToken } =
      await this.refreshTokensService.rotate(token);
    // роль беремо АКТУАЛЬНУ з БД — єдине місце, де вона перечитується
    const user = await this.usersService.findByIdOrFail(userId);
    return { accessToken: await this.signAccessToken(user), refreshToken };
  }

  async logout(token: string, userId: string): Promise<void> {
    await this.refreshTokensService.revoke(token, userId);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.refreshTokensService.issue(user.id),
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    // payload лише закодований, не зашифрований — кладемо мінімум; iat та exp додає JwtModule
    return this.jwtService.signAsync({ sub: user.id, role: user.role });
  }

  private emailTaken(email: string): ConflictException {
    this.logger.warn(`Повторна реєстрація пошти ${email}`);
    return new ConflictException(`Користувач з поштою ${email} вже існує`);
  }
}
