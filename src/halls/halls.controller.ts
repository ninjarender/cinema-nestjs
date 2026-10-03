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
import { CreateHallDto } from './dto/create-hall.dto.js';
import { HallWithSeats } from './dto/hall-with-seats.dto.js';
import { Hall } from './entities/hall.entity.js';
import { HallsService } from './halls.service.js';

@ApiTags('halls')
@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Post()
  @ApiCreatedResponse({ type: Hall })
  @ApiBadRequestResponse({
    description:
      'Поле відсутнє, має неправильний тип або число не є цілим додатним',
  })
  @ApiConflictResponse({ description: 'Зал з такою назвою вже існує' })
  async create(@Body() dto: CreateHallDto): Promise<Hall> {
    return this.hallsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [Hall] })
  async findAll(): Promise<Hall[]> {
    return this.hallsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: HallWithSeats })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Зал не знайдено' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HallWithSeats> {
    return this.hallsService.findOneWithSeats(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Зал видалено' })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Зал не знайдено' })
  @ApiConflictResponse({ description: 'На зал посилається хоча б один сеанс' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.hallsService.remove(id);
  }
}
