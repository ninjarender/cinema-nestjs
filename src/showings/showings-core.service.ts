import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Showing } from './entities/showing.entity.js';

/**
 * Сховище сеансів без жодних залежностей.
 *
 * Його імпортують і модуль сеансів, і модулі фільмів та залів (перевірка перед
 * видаленням), і модуль бронювань. Так зустрічна залежність films ↔ showings
 * не виникає: спільна частина винесена в окремий сервісний модуль (тема 4).
 */
@Injectable()
export class ShowingsCoreService {
  private readonly logger = new Logger(ShowingsCoreService.name);
  private readonly showings: Showing[] = [];

  add(showing: Showing): Showing {
    this.showings.push(showing);
    return showing;
  }

  findAll(): Showing[] {
    return this.showings;
  }

  findOne(id: string): Showing {
    const showing = this.showings.find((showing) => showing.id === id);
    if (!showing) {
      this.logger.warn(`Сеанс з id ${id} не знайдено`);
      throw new NotFoundException(`Сеанс з id ${id} не знайдено`);
    }
    return showing;
  }

  hasShowingsForFilm(filmId: string): boolean {
    return this.showings.some((showing) => showing.filmId === filmId);
  }

  hasShowingsForHall(hallId: string): boolean {
    return this.showings.some((showing) => showing.hallId === hallId);
  }
}
