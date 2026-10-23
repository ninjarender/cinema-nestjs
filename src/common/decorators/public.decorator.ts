import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Маршрут доступний без access-токена (глобальний JwtAuthGuard його пропускає). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
