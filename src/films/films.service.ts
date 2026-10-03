import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film } from './entities/film.entity.js';

@Injectable()
export class FilmsService {
  private readonly logger = new Logger(FilmsService.name);

  constructor(
    @InjectRepository(Film)
    private readonly filmsRepository: Repository<Film>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  async create(dto: CreateFilmDto): Promise<Film> {
    const film = this.filmsRepository.create(dto);
    return this.filmsRepository.save(film);
  }

  async findAll(): Promise<Film[]> {
    return this.filmsRepository.find();
  }

  async findOne(id: string): Promise<Film> {
    const film = await this.findById(id);
    if (film === null) {
      this.logger.warn(`Фільм з id ${id} не знайдено`);
      throw new NotFoundException(`Фільм з id ${id} не знайдено`);
    }
    return film;
  }

  /** Те саме, що findOne, але без винятку — для перевірок в інших модулях. */
  async findById(id: string): Promise<Film | null> {
    return this.filmsRepository.findOneBy({ id });
  }

  async update(id: string, dto: UpdateFilmDto): Promise<Film> {
    const film = await this.filmsRepository.preload({ id, ...dto });
    if (film === undefined) {
      this.logger.warn(`Фільм з id ${id} не знайдено`);
      throw new NotFoundException(`Фільм з id ${id} не знайдено`);
    }
    return this.filmsRepository.save(film);
  }

  async remove(id: string): Promise<void> {
    const film = await this.findOne(id);
    // Каскадного видалення сеансів немає: FK showings.film_id теж не дасть видалити фільм
    if (await this.showingsCore.hasShowingsForFilm(id)) {
      this.logger.warn(
        `Відмова видалити фільм ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Фільм не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    await this.filmsRepository.remove(film);
  }
}
