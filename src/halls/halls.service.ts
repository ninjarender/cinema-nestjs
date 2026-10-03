import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateHallDto } from './dto/create-hall.dto.js';
import { HallWithSeats, Seat } from './dto/hall-with-seats.dto.js';
import { Hall } from './entities/hall.entity.js';

@Injectable()
export class HallsService {
  private readonly logger = new Logger(HallsService.name);

  constructor(
    @InjectRepository(Hall)
    private readonly hallsRepository: Repository<Hall>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  async create(dto: CreateHallDto): Promise<Hall> {
    // Унікальний індекс у БД чутливий до регістру, тому "зал 1" і "Зал 1" перевіряємо тут
    const nameTaken = await this.hallsRepository
      .createQueryBuilder('hall')
      .where('LOWER(hall.name) = LOWER(:name)', { name: dto.name })
      .getExists();
    if (nameTaken) {
      throw this.nameConflict(dto.name);
    }

    try {
      return await this.hallsRepository.save(this.hallsRepository.create(dto));
    } catch (error) {
      // Два одночасні запити з тією самою назвою: другий відхилить unique-індекс
      if (isUniqueViolation(error)) {
        throw this.nameConflict(dto.name);
      }
      throw error;
    }
  }

  async findAll(): Promise<Hall[]> {
    return this.hallsRepository.find();
  }

  async findOne(id: string): Promise<Hall> {
    const hall = await this.findById(id);
    if (hall === null) {
      this.logger.warn(`Зал з id ${id} не знайдено`);
      throw new NotFoundException(`Зал з id ${id} не знайдено`);
    }
    return hall;
  }

  /** Те саме, що findOne, але без винятку — для перевірок в інших модулях. */
  async findById(id: string): Promise<Hall | null> {
    return this.hallsRepository.findOneBy({ id });
  }

  async findOneWithSeats(id: string): Promise<HallWithSeats> {
    const hall = await this.findOne(id);
    return {
      id: hall.id,
      name: hall.name,
      rows: hall.rows,
      seatsPerRow: hall.seatsPerRow,
      seats: this.getSeats(hall),
    };
  }

  /** Перелік місць залу: ряди й місця нумеруються з 1. */
  getSeats(hall: Hall): Seat[] {
    const seats: Seat[] = [];
    for (let row = 1; row <= hall.rows; row++) {
      for (let seat = 1; seat <= hall.seatsPerRow; seat++) {
        seats.push({ row, seat });
      }
    }
    return seats;
  }

  hasSeat(hall: Hall, { row, seat }: Seat): boolean {
    return (
      row >= 1 && row <= hall.rows && seat >= 1 && seat <= hall.seatsPerRow
    );
  }

  async remove(id: string): Promise<void> {
    const hall = await this.findOne(id);
    if (await this.showingsCore.hasShowingsForHall(id)) {
      this.logger.warn(
        `Відмова видалити зал ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Зал не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    await this.hallsRepository.remove(hall);
  }

  private nameConflict(name: string): ConflictException {
    this.logger.warn(`Відмова створити зал: назва "${name}" зайнята`);
    return new ConflictException(`Зал з назвою "${name}" вже існує`);
  }
}
