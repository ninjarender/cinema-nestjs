import { Module } from '@nestjs/common';
import { FilmsModule } from '../films/films.module.js';
import { HallsModule } from '../halls/halls.module.js';
import { ShowingsCoreModule } from './core.module.js';
import { ShowingsController } from './showings.controller.js';
import { ShowingsService } from './showings.service.js';

@Module({
  imports: [ShowingsCoreModule, FilmsModule, HallsModule],
  controllers: [ShowingsController],
  providers: [ShowingsService],
})
export class ShowingsModule {}
