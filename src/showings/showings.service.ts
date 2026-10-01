import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FilmsService } from '../films/films.service.js';
import { HallsService } from '../halls/halls.service.js';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { Showing, ShowingView } from './entities/showing.entity.js';
import { ShowingsCoreService } from './showings-core.service.js';

@Injectable()
export class ShowingsService {
  private readonly logger = new Logger(ShowingsService.name);

  constructor(
    private readonly showingsCore: ShowingsCoreService,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  create(dto: CreateShowingDto): Showing {
    if (!this.filmsService.findById(dto.filmId)) {
      this.logger.warn(
        `Спроба створити сеанс для неіснуючого фільму ${dto.filmId}`,
      );
      throw new BadRequestException(`Фільм з id ${dto.filmId} не знайдено`);
    }
    if (!this.hallsService.findById(dto.hallId)) {
      this.logger.warn(
        `Спроба створити сеанс у неіснуючому залі ${dto.hallId}`,
      );
      throw new BadRequestException(`Зал з id ${dto.hallId} не знайдено`);
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt вказує на момент у минулому');
    }

    return this.showingsCore.add({
      id: randomUUID(),
      filmId: dto.filmId,
      hallId: dto.hallId,
      startsAt: startsAt.toISOString(), // нормалізуємо до UTC, щоб сортування рядків було коректним
      price: dto.price,
    });
  }

  findAll({ filmId, date }: FindShowingsQueryDto): ShowingView[] {
    return this.showingsCore
      .findAll()
      .filter((showing) => filmId === undefined || showing.filmId === filmId)
      .filter(
        (showing) => date === undefined || showing.startsAt.startsWith(date),
      )
      .sort(
        (a, b) =>
          a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
      )
      .map((showing) => this.toView(showing));
  }

  findOne(id: string): ShowingView {
    return this.toView(this.showingsCore.findOne(id));
  }

  private toView(showing: Showing): ShowingView {
    return {
      id: showing.id,
      filmTitle: this.filmsService.findOne(showing.filmId).title,
      hallName: this.hallsService.findOne(showing.hallId).name,
      startsAt: showing.startsAt,
      price: showing.price,
    };
  }
}
