import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateHallDto } from './dto/create-hall.dto.js';
import { Hall, HallWithSeats, Seat } from './entities/hall.entity.js';

@Injectable()
export class HallsService {
  private readonly logger = new Logger(HallsService.name);
  private halls: Hall[] = [];

  constructor(private readonly showingsCore: ShowingsCoreService) {}

  create(dto: CreateHallDto): Hall {
    const nameTaken = this.halls.some(
      (hall) => hall.name.toLowerCase() === dto.name.toLowerCase(),
    );
    if (nameTaken) {
      this.logger.warn(`Відмова створити зал: назва "${dto.name}" зайнята`);
      throw new ConflictException(`Зал з назвою "${dto.name}" вже існує`);
    }

    const hall: Hall = {
      id: randomUUID(),
      name: dto.name,
      rows: dto.rows,
      seatsPerRow: dto.seatsPerRow,
    };
    this.halls.push(hall);
    return hall;
  }

  findAll(): Hall[] {
    return this.halls;
  }

  findOne(id: string): Hall {
    const hall = this.findById(id);
    if (!hall) {
      this.logger.warn(`Зал з id ${id} не знайдено`);
      throw new NotFoundException(`Зал з id ${id} не знайдено`);
    }
    return hall;
  }

  /** Те саме, що findOne, але без винятку — для перевірок в інших модулях. */
  findById(id: string): Hall | undefined {
    return this.halls.find((hall) => hall.id === id);
  }

  findOneWithSeats(id: string): HallWithSeats {
    const hall = this.findOne(id);
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

  remove(id: string): void {
    this.findOne(id);
    if (this.showingsCore.hasShowingsForHall(id)) {
      this.logger.warn(
        `Відмова видалити зал ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Зал не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    this.halls = this.halls.filter((hall) => hall.id !== id);
  }
}
