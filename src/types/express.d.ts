import { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';

declare module 'express' {
  interface Request {
    user: JwtPayload;
  }
}
