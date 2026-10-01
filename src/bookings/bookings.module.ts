import { Module } from '@nestjs/common';
import { HallsModule } from '../halls/halls.module.js';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [ShowingsCoreModule, HallsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
