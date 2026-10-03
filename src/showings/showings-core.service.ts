import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { Showing } from './entities/showing.entity.js';

/**
 * Доступ до сеансів, потрібний іншим модулям.
 *
 * Його імпортують і модуль сеансів, і модулі фільмів та залів (перевірка перед
 * видаленням), і модуль бронювань. Так зустрічна залежність films ↔ showings
 * не виникає: спільна частина винесена в окремий сервісний модуль (тема 4).
 */
@Injectable()
export class ShowingsCoreService {
  private readonly logger = new Logger(ShowingsCoreService.name);

  constructor(
    @InjectRepository(Showing)
    private readonly showingsRepository: Repository<Showing>,
  ) {}

  async findOne(
    id: string,
    relations?: FindOptionsRelations<Showing>,
  ): Promise<Showing> {
    const showing = await this.showingsRepository.findOne({
      where: { id },
      relations,
    });
    if (showing === null) {
      this.logger.warn(`Сеанс з id ${id} не знайдено`);
      throw new NotFoundException(`Сеанс з id ${id} не знайдено`);
    }
    return showing;
  }

  async hasShowingsForFilm(filmId: string): Promise<boolean> {
    return this.showingsRepository.existsBy({ filmId });
  }

  async hasShowingsForHall(hallId: string): Promise<boolean> {
    return this.showingsRepository.existsBy({ hallId });
  }
}
