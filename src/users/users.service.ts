import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /** Роль не приймається: новий користувач завжди отримує DEFAULT 'user'. */
  async create(dto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash: dto.passwordHash,
    });
    return this.usersRepository.save(user); // екземпляр User → @Exclude спрацює
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (user === null) {
      // id прийшов із підписаного токена → користувача видалили після видачі
      this.logger.warn(`Користувача з id ${id} не знайдено`);
      throw new NotFoundException(`Користувача з id ${id} не знайдено`);
    }
    return user;
  }
}
