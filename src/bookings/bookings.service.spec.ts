import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Hall } from '../halls/entities/hall.entity.js';
import { HallsService } from '../halls/halls.service.js';
import { Showing } from '../showings/entities/showing.entity.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { BookingsService } from './bookings.service.js';
import { BookingSeat } from './entities/booking-seat.entity.js';
import { Booking } from './entities/booking.entity.js';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UserRole } from '../users/user-role.enum.js';

const hall: Hall = { id: 'hall-1', name: 'Зал 1', rows: 3, seatsPerRow: 5 };
const showing: Showing = {
  id: 'showing-1',
  filmId: 'film-1',
  hallId: hall.id,
  startsAt: new Date('2099-01-01T18:00:00.000Z'),
  price: 12500,
  hall,
};

const OWNER_ID = 'user-1';
const tokenOf = (sub: string, role: UserRole): JwtPayload => ({
  sub,
  role,
  iat: 0,
  exp: 0,
});

const uniqueViolation = () =>
  new QueryFailedError('INSERT', [], {
    code: '23505',
    detail: 'Key (showing_id, "row", seat)=(...) already exists.',
  } as unknown as Error);

describe('BookingsService', () => {
  let service: BookingsService;

  // Замінники залежностей: модульний тест перевіряє лише BookingsService
  const showingsCore = { findOne: vi.fn() };
  const hallsService = {
    hasSeat: vi.fn(
      (h: Hall, s: { row: number; seat: number }) =>
        s.row <= h.rows && s.seat <= h.seatsPerRow,
    ),
    getSeats: vi.fn(),
  };
  const bookingsRepository = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    delete: vi.fn(),
  };
  const bookingSeatsRepository = { find: vi.fn() };
  // manager транзакції: create повертає дані як є, save «генерує» id
  const manager = {
    create: vi.fn((_entity: unknown, data: object) => ({ ...data })),
    save: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    showingsCore.findOne.mockResolvedValue(showing);
    bookingSeatsRepository.find.mockResolvedValue([]);
    manager.save.mockImplementation(async (value: object) =>
      Array.isArray(value) ? value : Object.assign(value, { id: 'booking-1' }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        {
          provide: getRepositoryToken(BookingSeat),
          useValue: bookingSeatsRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ShowingsCoreService, useValue: showingsCore },
        { provide: HallsService, useValue: hallsService },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  it('пише бронювання й місця в одній транзакції, ціна = ціна сеансу × місця', async () => {
    const booking = await service.create(
      showing.id,
      {
        seats: [
          { row: 1, seat: 2 },
          { row: 1, seat: 1 },
        ],
      },
      OWNER_ID,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(Booking, {
      showingId: showing.id,
      userId: OWNER_ID, // власник — з токена, не з тіла
      totalPrice: 25000,
    });
    expect(manager.create).toHaveBeenCalledWith(BookingSeat, {
      bookingId: 'booking-1',
      showingId: showing.id,
      row: 1,
      seat: 1,
    });
    expect(booking).toMatchObject({
      id: 'booking-1',
      showingId: showing.id,
      totalPrice: 25000,
      seats: [
        { row: 1, seat: 1 },
        { row: 1, seat: 2 },
      ],
    });
  });

  it('перетворює порушення унікального індексу на 409 без тексту помилки БД', async () => {
    manager.save.mockImplementation(async (value: object) => {
      if (Array.isArray(value)) throw uniqueViolation();
      return Object.assign(value, { id: 'booking-1' });
    });
    bookingSeatsRepository.find.mockResolvedValue([{ row: 1, seat: 5 }]);

    const error = await service
      .create(
        showing.id,
        {
          seats: [
            { row: 2, seat: 1 },
            { row: 1, seat: 5 },
          ],
        },
        OWNER_ID,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'Місця вже заброньовані на цьому сеансі: ряд 1 місце 5',
    );
    expect((error as ConflictException).message).not.toContain('Key');
  });

  it('інші помилки БД не маскує під 409', async () => {
    const fkError = new QueryFailedError('INSERT', [], {
      code: '23503',
    } as unknown as Error);
    manager.save.mockRejectedValue(fkError);

    await expect(
      service.create(showing.id, { seats: [{ row: 1, seat: 1 }] }, OWNER_ID),
    ).rejects.toBe(fkError);
  });

  it('відхиляє місце поза межами залу без транзакції', async () => {
    await expect(
      service.create(showing.id, { seats: [{ row: 4, seat: 1 }] }, OWNER_ID),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('передає далі 404, якщо сеансу немає', async () => {
    showingsCore.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create('missing', { seats: [{ row: 1, seat: 1 }] }, OWNER_ID),
    ).rejects.toThrow(NotFoundException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('remove — перевірка власника', () => {
    beforeEach(() => {
      bookingsRepository.findOneBy.mockResolvedValue({
        id: 'booking-1',
        userId: OWNER_ID,
      });
    });

    it('повертає 404 на скасування неіснуючого бронювання', async () => {
      bookingsRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove('missing', tokenOf(OWNER_ID, UserRole.User)),
      ).rejects.toThrow(NotFoundException);
      expect(bookingsRepository.delete).not.toHaveBeenCalled();
    });

    it('власник скасовує своє бронювання', async () => {
      await service.remove('booking-1', tokenOf(OWNER_ID, UserRole.User));

      expect(bookingsRepository.delete).toHaveBeenCalledWith({
        id: 'booking-1',
      });
    });

    it('чуже бронювання → 403 і нічого не видаляється', async () => {
      await expect(
        service.remove('booking-1', tokenOf('user-2', UserRole.User)),
      ).rejects.toThrow(ForbiddenException);
      expect(bookingsRepository.delete).not.toHaveBeenCalled();
    });

    it('адміністратор скасовує будь-яке бронювання', async () => {
      await service.remove('booking-1', tokenOf('admin-1', UserRole.Admin));

      expect(bookingsRepository.delete).toHaveBeenCalledWith({
        id: 'booking-1',
      });
    });
  });
});
