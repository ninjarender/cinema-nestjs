import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { PaginatedShowingsDto } from './dto/paginated-showings.dto.js';
import { ShowingView } from './dto/showing-view.dto.js';
import { Showing } from './entities/showing.entity.js';
import { ShowingsService } from './showings.service.js';

@ApiTags('showings')
@Controller('showings')
export class ShowingsController {
  constructor(private readonly showingsService: ShowingsService) {}

  @Post()
  @ApiCreatedResponse({ type: Showing })
  @ApiBadRequestResponse({
    description:
      'Фільму або залу немає; startsAt не ISO 8601 або в минулому; price не ціле додатне',
  })
  async create(@Body() dto: CreateShowingDto): Promise<Showing> {
    return this.showingsService.create(dto);
  }

  @Get()
  @ApiOkResponse({
    type: PaginatedShowingsDto,
    description:
      'Сторінка сеансів, відсортованих за startsAt (sort), при рівному часі — за id',
  })
  @ApiBadRequestResponse({
    description:
      'filmId не UUID; date не YYYY-MM-DD; page/limit не цілі або поза межами; sort не asc/desc',
  })
  async findAll(
    @Query() query: FindShowingsQueryDto,
  ): Promise<PaginatedShowingsDto> {
    return this.showingsService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ShowingView })
  @ApiBadRequestResponse({ description: 'id не є UUID' })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ShowingView> {
    return this.showingsService.findOne(id);
  }
}
