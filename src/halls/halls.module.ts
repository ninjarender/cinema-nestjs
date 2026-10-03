import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { Hall } from './entities/hall.entity.js';
import { HallsController } from './halls.controller.js';
import { HallsService } from './halls.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Hall]), ShowingsCoreModule],
  controllers: [HallsController],
  providers: [HallsService],
  exports: [HallsService],
})
export class HallsModule {}
