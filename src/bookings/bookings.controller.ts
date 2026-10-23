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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/user-role.enum.js';
import { BookingsService } from './bookings.service.js';
import {
  BookingView,
  MyBookingView,
  SeatAvailability,
} from './dto/booking-view.dto.js';
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
  @Roles(UserRole.Admin)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [BookingView] })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description: 'Недостатньо прав (потрібна роль admin)',
  })
  async findAll(): Promise<BookingView[]> {
    return this.bookingsService.findAll();
  }

  // Оголошено ДО маршрутів bookings/:id, щоб «my» не потрапило в :id
  @Get('bookings/my')
  @ApiBearerAuth()
  @ApiOkResponse({ type: [MyBookingView] })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  async findMine(@CurrentUser('sub') userId: string): Promise<MyBookingView[]> {
    return this.bookingsService.findMine(userId);
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({
    description: 'Бронювання скасовано, місця звільнено',
  })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description:
      'Бронювання належить іншому користувачу (admin може скасувати будь-яке)',
  })
  @ApiNotFoundResponse({ description: 'Бронювання не знайдено' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.bookingsService.remove(id, user);
  }

  @Post('showings/:id/bookings')
  @ApiBearerAuth()
  @ApiCreatedResponse({
    type: BookingView,
    description: 'Бронювання на користувача з токена',
  })
  @ApiBadRequestResponse({
    description:
      'seats порожній або елемент без row/seat; місце повторюється; місця немає в залі',
  })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  @ApiConflictResponse({
    description:
      'Хоча б одне місце вже заброньоване; транзакція відкочується, жодне місце не бронюється',
  })
  async create(
    @Param('id', ParseUUIDPipe) showingId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser('sub') userId: string,
  ): Promise<BookingView> {
    return this.bookingsService.create(showingId, dto, userId);
  }

  @Get('showings/:id/bookings')
  @Roles(UserRole.Admin)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [BookingView] })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description: 'Недостатньо прав (потрібна роль admin)',
  })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async findByShowing(
    @Param('id', ParseUUIDPipe) showingId: string,
  ): Promise<BookingView[]> {
    return this.bookingsService.findByShowing(showingId);
  }

  @Public()
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
