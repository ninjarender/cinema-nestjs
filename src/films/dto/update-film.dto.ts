import { PartialType } from '@nestjs/swagger';
import { CreateFilmDto } from './create-film.dto.js';

export class UpdateFilmDto extends PartialType(CreateFilmDto) {}
