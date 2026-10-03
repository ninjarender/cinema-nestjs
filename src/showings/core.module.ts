import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Showing } from './entities/showing.entity.js';
import { ShowingsCoreService } from './showings-core.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Showing])],
  providers: [ShowingsCoreService],
  exports: [ShowingsCoreService],
})
export class ShowingsCoreModule {}
