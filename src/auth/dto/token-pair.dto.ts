import { ApiProperty } from '@nestjs/swagger';
import { TokenPair } from '../interfaces/token-pair.interface.js';

export class TokenPairDto implements TokenPair {
  @ApiProperty({ description: 'JWT, передається в Authorization: Bearer' })
  accessToken: string;

  @ApiProperty({
    description: 'Випадковий рядок для POST /auth/refresh і /auth/logout',
  })
  refreshToken: string;
}
