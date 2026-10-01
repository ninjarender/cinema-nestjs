import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { Booking, SeatAvailability } from './entities/booking.entity.js';

/**
 * Маршрути бронювань і зайнятості місць.
 * Частина з них вкладена в /showings/:id, бо стосується конкретного сеансу,
 * але дані про зайнятість належать саме бронюванням.
 */
@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  @ApiOkResponse({ type: [Booking] })
  findAll(): Booking[] {
    return this.bookingsService.findAll();
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Бронювання скасовано, місця звільнено',
  })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Бронювання не знайдено' })
  remove(@Param('id', ParseUUIDPipe) id: string): void {
    this.bookingsService.remove(id);
  }

  @Post('showings/:id/bookings')
  @ApiCreatedResponse({ type: Booking })
  @ApiBadRequestResponse({
    description:
      'seats порожній або елемент без row/seat; місце повторюється; місця немає в залі',
  })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  @ApiConflictResponse({
    description:
      'Хоча б одне місце вже заброньоване; жодне місце не бронюється',
  })
  create(
    @Param('id', ParseUUIDPipe) showingId: string,
    @Body() dto: CreateBookingDto,
  ): Booking {
    return this.bookingsService.create(showingId, dto);
  }

  @Get('showings/:id/bookings')
  @ApiOkResponse({ type: [Booking] })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  findByShowing(@Param('id', ParseUUIDPipe) showingId: string): Booking[] {
    return this.bookingsService.findByShowing(showingId);
  }

  @Get('showings/:id/seats')
  @ApiOkResponse({
    type: [SeatAvailability],
    description: 'Усі місця залу сеансу з ознакою зайнятості',
  })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  getSeats(@Param('id', ParseUUIDPipe) showingId: string): SeatAvailability[] {
    return this.bookingsService.getSeatsForShowing(showingId);
  }
}
