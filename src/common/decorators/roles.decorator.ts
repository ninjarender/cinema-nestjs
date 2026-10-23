import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user-role.enum.js';

export const ROLES_KEY = 'roles';
/** Ролі, яким дозволено маршрут; перевіряє RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
