import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Єдиний формат відповіді з помилкою для всього API:
 * { statusCode, timestamp, path, message }.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // ValidationPipe кладе в message масив рядків, решта винятків — рядок
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ??
          exception.message);

    // 4xx — очікувані помилки клієнта, error лишаємо для збоїв сервера
    const summary = `${request.method} ${request.url} -> ${status}`;
    if (status >= 500) {
      this.logger.error(summary, exception.stack);
    } else {
      this.logger.warn(summary);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
