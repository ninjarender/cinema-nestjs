import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { EnvironmentVariables } from '../config/environment-variables.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex'); // не JWT: підпис не потрібен — шукаємо в таблиці
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);
    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        tokenHash: this.hash(token),
        userId,
        expiresAt,
      }),
    );
    return token; // клієнту — сам токен, у БД — хеш
  }

  /**
   * Споживає токен одним DELETE … RETURNING: з двох паралельних запитів
   * з тим самим токеном рядок отримає лише один, другий дістане 401.
   */
  async rotate(token: string): Promise<{ userId: string; token: string }> {
    const result = await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('token_hash = :tokenHash AND expires_at > now()', {
        tokenHash: this.hash(token),
      })
      .returning('user_id')
      .execute();

    const [consumed] = result.raw as { user_id: string }[];
    if (consumed === undefined) {
      // не існує, прострочений або вже використаний
      this.logger.warn('Спроба оновлення з недійсним refresh-токеном');
      throw new UnauthorizedException('Refresh-токен недійсний');
    }
    return {
      userId: consumed.user_id,
      token: await this.issue(consumed.user_id),
    };
  }

  /** Відкликає лише токен поточного користувача: чужий чи неіснуючий → 404. */
  async revoke(token: string, userId: string): Promise<void> {
    const result = await this.refreshTokensRepository.delete({
      tokenHash: this.hash(token),
      userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Refresh-токен не знайдено');
    }
  }

  /** Детермінований хеш: той самий токен завжди дає той самий рядок для WHERE. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
