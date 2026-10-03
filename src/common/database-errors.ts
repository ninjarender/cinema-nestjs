import { QueryFailedError } from 'typeorm';

/** Код помилки PostgreSQL «порушено унікальний індекс». */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string };
  return driverError.code === UNIQUE_VIOLATION;
}
