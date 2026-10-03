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
import { BookingView, SeatAvailability } from './dto/booking-view.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

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
  @ApiOkResponse({ type: [BookingView] })
  async findAll(): Promise<BookingView[]> {
    return this.bookingsService.findAll();
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Бронювання скасовано, місця звільнено',
  })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Бронювання не знайдено' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.bookingsService.remove(id);
  }

  @Post('showings/:id/bookings')
  @ApiCreatedResponse({ type: BookingView })
  @ApiBadRequestResponse({
    description:
      'seats порожній або елемент без row/seat; місце повторюється; місця немає в залі',
  })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  @ApiConflictResponse({
    description:
      'Хоча б одне місце вже заброньоване; транзакція відкочується, жодне місце не бронюється',
  })
  async create(
    @Param('id', ParseUUIDPipe) showingId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingView> {
    return this.bookingsService.create(showingId, dto);
  }

  @Get('showings/:id/bookings')
  @ApiOkResponse({ type: [BookingView] })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async findByShowing(
    @Param('id', ParseUUIDPipe) showingId: string,
  ): Promise<BookingView[]> {
    return this.bookingsService.findByShowing(showingId);
  }

  @Get('showings/:id/seats')
  @ApiOkResponse({
    type: [SeatAvailability],
    description: 'Усі місця залу сеансу з ознакою зайнятості',
  })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async getSeats(
    @Param('id', ParseUUIDPipe) showingId: string,
  ): Promise<SeatAvailability[]> {
    return this.bookingsService.getSeatsForShowing(showingId);
  }
}
