import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film } from './entities/film.entity.js';

@Injectable()
export class FilmsService {
  private readonly logger = new Logger(FilmsService.name);
  private films: Film[] = [];

  constructor(private readonly showingsCore: ShowingsCoreService) {}

  create(dto: CreateFilmDto): Film {
    const film: Film = {
      id: randomUUID(),
      title: dto.title,
      durationMinutes: dto.durationMinutes,
      releaseYear: dto.releaseYear,
    };
    this.films.push(film);
    return film;
  }

  findAll(): Film[] {
    return this.films;
  }

  findOne(id: string): Film {
    const film = this.findById(id);
    if (!film) {
      this.logger.warn(`Фільм з id ${id} не знайдено`);
      throw new NotFoundException(`Фільм з id ${id} не знайдено`);
    }
    return film;
  }

  /** Те саме, що findOne, але без винятку — для перевірок в інших модулях. */
  findById(id: string): Film | undefined {
    return this.films.find((film) => film.id === id);
  }

  update(id: string, dto: UpdateFilmDto): Film {
    const film = this.findOne(id);
    Object.assign(film, dto);
    return film;
  }

  remove(id: string): void {
    this.findOne(id);
    if (this.showingsCore.hasShowingsForFilm(id)) {
      this.logger.warn(
        `Відмова видалити фільм ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Фільм не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    this.films = this.films.filter((film) => film.id !== id);
  }
}
