import { Module } from '@nestjs/common';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { HallsController } from './halls.controller.js';
import { HallsService } from './halls.service.js';

@Module({
  imports: [ShowingsCoreModule],
  controllers: [HallsController],
  providers: [HallsService],
  exports: [HallsService],
})
export class HallsModule {}
