import { UserRole } from '../../users/user-role.enum.js';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}
