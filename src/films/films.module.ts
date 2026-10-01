import { Module } from '@nestjs/common';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { FilmsController } from './films.controller.js';
import { FilmsService } from './films.service.js';

@Module({
  imports: [ShowingsCoreModule],
  controllers: [FilmsController],
  providers: [FilmsService],
  exports: [FilmsService],
})
export class FilmsModule {}
