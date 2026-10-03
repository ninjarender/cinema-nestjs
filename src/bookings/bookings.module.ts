import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HallsModule } from '../halls/halls.module.js';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingSeat } from './entities/booking-seat.entity.js';
import { Booking } from './entities/booking.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingSeat]),
    ShowingsCoreModule,
    HallsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
