import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    description:
      'Refresh-токен, отриманий під час входу або попереднього оновлення',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
