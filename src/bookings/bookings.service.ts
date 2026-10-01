import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Seat } from '../halls/entities/hall.entity.js';
import { HallsService } from '../halls/halls.service.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { Booking, SeatAvailability } from './entities/booking.entity.js';

const seatKey = ({ row, seat }: Seat): string => `${row}:${seat}`;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private bookings: Booking[] = [];

  constructor(
    private readonly showingsCore: ShowingsCoreService,
    private readonly hallsService: HallsService,
  ) {}

  findAll(): Booking[] {
    return this.bookings;
  }

  findByShowing(showingId: string): Booking[] {
    this.showingsCore.findOne(showingId);
    return this.bookings.filter((booking) => booking.showingId === showingId);
  }

  create(showingId: string, dto: CreateBookingDto): Booking {
    const showing = this.showingsCore.findOne(showingId);
    const hall = this.hallsService.findOne(showing.hallId);

    const outsideHall = dto.seats.filter(
      (seat) => !this.hallsService.hasSeat(hall, seat),
    );
    if (outsideHall.length > 0) {
      throw new BadRequestException(
        `У залі "${hall.name}" (${hall.rows} рядів × ${hall.seatsPerRow} місць) немає місць: ${this.formatSeats(outsideHall)}`,
      );
    }

    // Спершу перевіряємо всі місця, і лише потім записуємо — без часткового бронювання.
    const booked = this.bookedSeatKeys(showingId);
    const taken = dto.seats.filter((seat) => booked.has(seatKey(seat)));
    if (taken.length > 0) {
      this.logger.warn(
        `Конфлікт бронювання на сеансі ${showingId}: ${this.formatSeats(taken)}`,
      );
      throw new ConflictException(
        `Місця вже заброньовані на цьому сеансі: ${this.formatSeats(taken)}`,
      );
    }

    const booking: Booking = {
      id: randomUUID(),
      showingId,
      seats: dto.seats.map(({ row, seat }) => ({ row, seat })),
      totalPrice: showing.price * dto.seats.length,
    };
    this.bookings.push(booking);
    return booking;
  }

  getSeatsForShowing(showingId: string): SeatAvailability[] {
    const showing = this.showingsCore.findOne(showingId);
    const hall = this.hallsService.findOne(showing.hallId);
    const booked = this.bookedSeatKeys(showingId);

    return this.hallsService.getSeats(hall).map(({ row, seat }) => ({
      row,
      seat,
      isBooked: booked.has(seatKey({ row, seat })),
    }));
  }

  remove(id: string): void {
    const exists = this.bookings.some((booking) => booking.id === id);
    if (!exists) {
      this.logger.warn(`Бронювання з id ${id} не знайдено`);
      throw new NotFoundException(`Бронювання з id ${id} не знайдено`);
    }
    this.bookings = this.bookings.filter((booking) => booking.id !== id);
  }

  private bookedSeatKeys(showingId: string): Set<string> {
    return new Set(
      this.bookings
        .filter((booking) => booking.showingId === showingId)
        .flatMap((booking) => booking.seats.map(seatKey)),
    );
  }

  private formatSeats(seats: Seat[]): string {
    return seats.map(({ row, seat }) => `ряд ${row} місце ${seat}`).join(', ');
  }
}
