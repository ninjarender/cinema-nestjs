import { ApiProperty } from '@nestjs/swagger';
import { ShowingView } from './showing-view.dto.js';

export class PaginatedShowingsDto {
  @ApiProperty({ type: [ShowingView] })
  items: ShowingView[];

  @ApiProperty({
    example: 42,
    description: 'Кількість сеансів, що відповідають фільтрам',
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
