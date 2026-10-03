import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { Seat } from '../halls/dto/hall-with-seats.dto.js';
import { HallsService } from '../halls/halls.service.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { BookingView, SeatAvailability } from './dto/booking-view.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingSeat } from './entities/booking-seat.entity.js';
import { Booking } from './entities/booking.entity.js';

const seatKey = ({ row, seat }: Seat): string => `${row}:${seat}`;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(BookingSeat)
    private readonly bookingSeatsRepository: Repository<BookingSeat>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly showingsCore: ShowingsCoreService,
    private readonly hallsService: HallsService,
  ) {}

  async findAll(): Promise<BookingView[]> {
    const bookings = await this.bookingsRepository.find({
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return bookings.map((booking) => this.toView(booking));
  }

  async findByShowing(showingId: string): Promise<BookingView[]> {
    await this.showingsCore.findOne(showingId);
    const bookings = await this.bookingsRepository.find({
      where: { showingId },
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return bookings.map((booking) => this.toView(booking));
  }

  async create(showingId: string, dto: CreateBookingDto): Promise<BookingView> {
    const showing = await this.showingsCore.findOne(showingId, { hall: true });
    const hall = showing.hall!;

    const outsideHall = dto.seats.filter(
      (seat) => !this.hallsService.hasSeat(hall, seat),
    );
    if (outsideHall.length > 0) {
      throw new BadRequestException(
        `У залі "${hall.name}" (${hall.rows} рядів × ${hall.seatsPerRow} місць) немає місць: ${this.formatSeats(outsideHall)}`,
      );
    }

    // Зайнятість не перевіряємо заздалегідь: між перевіркою і записом місце могли б
    // забрати. Гарантію дає унікальний індекс (showing_id, row, seat) у booking_seats.
    try {
      const booking = await this.dataSource.transaction(async (manager) => {
        const booking = manager.create(Booking, {
          showingId,
          totalPrice: showing.price * dto.seats.length,
        });
        await manager.save(booking); // id генерує БД — тому місця ПІСЛЯ save

        const seats = dto.seats.map(({ row, seat }) =>
          manager.create(BookingSeat, {
            bookingId: booking.id,
            showingId,
            row,
            seat,
          }),
        );
        booking.seats = await manager.save(seats);

        return booking;
      });
      return this.toView(booking);
    } catch (error) {
      // try навколо transaction: ROLLBACK уже відбувся, у БД немає ні бронювання, ні місць
      if (isUniqueViolation(error)) {
        throw await this.seatsTakenConflict(showingId, dto.seats);
      }
      throw error; // решта помилок БД лишаються 500
    }
  }

  async getSeatsForShowing(showingId: string): Promise<SeatAvailability[]> {
    const showing = await this.showingsCore.findOne(showingId, { hall: true });
    const booked = await this.bookedSeatKeys(showingId);

    return this.hallsService.getSeats(showing.hall!).map(({ row, seat }) => ({
      row,
      seat,
      isBooked: booked.has(seatKey({ row, seat })),
    }));
  }

  async remove(id: string): Promise<void> {
    // Місця видаляє сама БД: ON DELETE CASCADE на booking_seats.booking_id
    const result = await this.bookingsRepository.delete({ id });
    if (result.affected === 0) {
      this.logger.warn(`Бронювання з id ${id} не знайдено`);
      throw new NotFoundException(`Бронювання з id ${id} не знайдено`);
    }
  }

  /** 409 зі списком зайнятих місць — без тексту помилки БД. */
  private async seatsTakenConflict(
    showingId: string,
    requested: Seat[],
  ): Promise<ConflictException> {
    const booked = await this.bookedSeatKeys(showingId);
    const taken = requested.filter((seat) => booked.has(seatKey(seat)));
    const details = taken.length > 0 ? `: ${this.formatSeats(taken)}` : '';

    this.logger.warn(`Конфлікт бронювання на сеансі ${showingId}${details}`);
    return new ConflictException(
      `Місця вже заброньовані на цьому сеансі${details}`,
    );
  }

  private async bookedSeatKeys(showingId: string): Promise<Set<string>> {
    const seats = await this.bookingSeatsRepository.find({
      select: { row: true, seat: true },
      where: { showingId },
    });
    return new Set(seats.map(seatKey));
  }

  private toView(booking: Booking): BookingView {
    const seats = (booking.seats ?? [])
      .map(({ row, seat }) => ({ row, seat }))
      .sort((a, b) => a.row - b.row || a.seat - b.seat);
    return {
      id: booking.id,
      showingId: booking.showingId,
      seats,
      totalPrice: booking.totalPrice,
      createdAt: booking.createdAt,
    };
  }

  private formatSeats(seats: Seat[]): string {
    return seats.map(({ row, seat }) => `ряд ${row} місце ${seat}`).join(', ');
  }
}
