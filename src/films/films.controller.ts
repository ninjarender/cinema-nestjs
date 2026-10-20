import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/user-role.enum.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film } from './entities/film.entity.js';
import { FilmsService } from './films.service.js';

@ApiTags('films')
@Controller('films')
export class FilmsController {
  constructor(private readonly filmsService: FilmsService) {}

  @Post()
  @Roles(UserRole.Admin)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description: 'Недостатньо прав (потрібна роль admin)',
  })
  @ApiCreatedResponse({ type: Film })
  @ApiBadRequestResponse({
    description: 'Поле відсутнє або має неправильний тип',
  })
  async create(@Body() dto: CreateFilmDto): Promise<Film> {
    return this.filmsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOkResponse({ type: [Film] })
  async findAll(): Promise<Film[]> {
    return this.filmsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: Film })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Film> {
    return this.filmsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description: 'Недостатньо прав (потрібна роль admin)',
  })
  @ApiOkResponse({ type: Film })
  @ApiBadRequestResponse({
    description: 'Неправильний тип поля або id не є UUID',
  })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFilmDto,
  ): Promise<Film> {
    return this.filmsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiForbiddenResponse({
    description: 'Недостатньо прав (потрібна роль admin)',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Фільм видалено' })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  @ApiConflictResponse({
    description: 'На фільм посилається хоча б один сеанс',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.filmsService.remove(id);
  }
}
