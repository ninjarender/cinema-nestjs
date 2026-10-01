import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Hall } from '../halls/entities/hall.entity.js';
import { HallsService } from '../halls/halls.service.js';
import { Showing } from '../showings/entities/showing.entity.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { BookingsService } from './bookings.service.js';

const hall: Hall = { id: 'hall-1', name: 'Зал 1', rows: 3, seatsPerRow: 5 };
const showing: Showing = {
  id: 'showing-1',
  filmId: 'film-1',
  hallId: hall.id,
  startsAt: '2099-01-01T18:00:00.000Z',
  price: 12500,
};

describe('BookingsService', () => {
  let service: BookingsService;

  // Замінники залежностей: модульний тест перевіряє лише BookingsService
  const showingsCore = { findOne: vi.fn() };
  const hallsService = {
    findOne: vi.fn(),
    hasSeat: vi.fn(),
    getSeats: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    showingsCore.findOne.mockReturnValue(showing);
    hallsService.findOne.mockReturnValue(hall);
    hallsService.hasSeat.mockImplementation(
      (h: Hall, s: { row: number; seat: number }) =>
        s.row <= h.rows && s.seat <= h.seatsPerRow,
    );
    hallsService.getSeats.mockReturnValue([
      { row: 1, seat: 1 },
      { row: 1, seat: 2 },
      { row: 2, seat: 1 },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: ShowingsCoreService, useValue: showingsCore },
        { provide: HallsService, useValue: hallsService },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  it('рахує підсумкову ціну як ціну сеансу × кількість місць', () => {
    const booking = service.create(showing.id, {
      seats: [
        { row: 1, seat: 1 },
        { row: 1, seat: 2 },
      ],
    });

    expect(booking.totalPrice).toBe(25000);
    expect(showingsCore.findOne).toHaveBeenCalledWith(showing.id);
    expect(hallsService.findOne).toHaveBeenCalledWith(showing.hallId);
  });

  it('не бронює жодного місця, якщо хоча б одне вже зайняте', () => {
    service.create(showing.id, { seats: [{ row: 1, seat: 1 }] });

    expect(() =>
      service.create(showing.id, {
        seats: [
          { row: 2, seat: 1 },
          { row: 1, seat: 1 },
        ],
      }),
    ).toThrow(ConflictException);

    expect(service.findAll()).toHaveLength(1);
    expect(
      service.getSeatsForShowing(showing.id).filter((s) => s.isBooked),
    ).toEqual([{ row: 1, seat: 1, isBooked: true }]);
  });

  it('відхиляє місце поза межами залу', () => {
    expect(() =>
      service.create(showing.id, { seats: [{ row: 4, seat: 1 }] }),
    ).toThrow(BadRequestException);
    expect(service.findAll()).toHaveLength(0);
  });

  it('передає далі 404, якщо сеансу немає', () => {
    showingsCore.findOne.mockImplementation(() => {
      throw new NotFoundException();
    });

    expect(() =>
      service.create('missing', { seats: [{ row: 1, seat: 1 }] }),
    ).toThrow(NotFoundException);
    expect(hallsService.findOne).not.toHaveBeenCalled();
  });

  it('звільняє місця після скасування бронювання', () => {
    const booking = service.create(showing.id, {
      seats: [{ row: 2, seat: 1 }],
    });

    service.remove(booking.id);

    expect(service.getSeatsForShowing(showing.id).some((s) => s.isBooked)).toBe(
      false,
    );
    expect(() => service.remove(booking.id)).toThrow(NotFoundException);
  });
});
