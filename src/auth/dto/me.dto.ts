import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/user-role.enum.js';

export class MeDto {
  @ApiProperty({ example: 'f2b1c9e4-3a7d-4e8b-9c1f-5d6a7b8c9d0e' })
  id: string;

  @ApiProperty({ example: 'olena@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.User })
  role: UserRole;
}
