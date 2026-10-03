import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilmsService } from '../films/films.service.js';
import { HallsService } from '../halls/halls.service.js';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { PaginatedShowingsDto } from './dto/paginated-showings.dto.js';
import { ShowingView } from './dto/showing-view.dto.js';
import { Showing } from './entities/showing.entity.js';
import { ShowingsCoreService } from './showings-core.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ShowingsService {
  private readonly logger = new Logger(ShowingsService.name);

  constructor(
    @InjectRepository(Showing)
    private readonly showingsRepository: Repository<Showing>,
    private readonly showingsCore: ShowingsCoreService,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(dto: CreateShowingDto): Promise<Showing> {
    if ((await this.filmsService.findById(dto.filmId)) === null) {
      this.logger.warn(
        `Спроба створити сеанс для неіснуючого фільму ${dto.filmId}`,
      );
      throw new BadRequestException(`Фільм з id ${dto.filmId} не знайдено`);
    }
    if ((await this.hallsService.findById(dto.hallId)) === null) {
      this.logger.warn(
        `Спроба створити сеанс у неіснуючому залі ${dto.hallId}`,
      );
      throw new BadRequestException(`Зал з id ${dto.hallId} не знайдено`);
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt вказує на момент у минулому');
    }

    const showing = this.showingsRepository.create({
      filmId: dto.filmId,
      hallId: dto.hallId,
      startsAt,
      price: dto.price,
    });
    return this.showingsRepository.save(showing);
  }

  /** Фільтрація, сортування й сторінка — одним запитом до БД. */
  async findAll(query: FindShowingsQueryDto): Promise<PaginatedShowingsDto> {
    const { filmId, date, page, limit, sort } = query;

    const qb = this.showingsRepository
      .createQueryBuilder('showing')
      .innerJoinAndSelect('showing.film', 'film')
      .innerJoinAndSelect('showing.hall', 'hall');

    if (filmId !== undefined) {
      qb.andWhere('showing.filmId = :filmId', { filmId });
    }
    if (date !== undefined) {
      // Доба за UTC як півінтервал [00:00, наступна 00:00) — індекс по starts_at лишається придатним
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      qb.andWhere('showing.startsAt >= :dayStart', { dayStart }).andWhere(
        'showing.startsAt < :dayEnd',
        { dayEnd },
      );
    }

    const order = sort === 'desc' ? 'DESC' : 'ASC';
    const [showings, total] = await qb
      .orderBy('showing.startsAt', order)
      .addOrderBy('showing.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: showings.map((showing) => this.toView(showing)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<ShowingView> {
    const showing = await this.showingsCore.findOne(id, {
      film: true,
      hall: true,
    });
    return this.toView(showing);
  }

  /** Очікує сеанс із завантаженими film і hall. */
  private toView(showing: Showing): ShowingView {
    return {
      id: showing.id,
      filmTitle: showing.film!.title,
      hallName: showing.hall!.name,
      startsAt: showing.startsAt,
      price: showing.price,
    };
  }
}
