import { Module } from '@nestjs/common';
import { ShowingsCoreService } from './showings-core.service.js';

@Module({
  providers: [ShowingsCoreService],
  exports: [ShowingsCoreService],
})
export class ShowingsCoreModule {}
