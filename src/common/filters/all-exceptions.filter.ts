import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId = request[CORRELATION_ID_HEADER];
    const userId = request.user?.['sub'];

    // For HttpExceptions, use the full response (preserves validation details);
    // for unknown errors, return a generic message to avoid leaking internals
    let message: string | object;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse;
    } else {
      message = 'Internal server error';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(typeof message === 'object' ? message : { message }),
      correlationId,
    };

    if (status >= 500) {
      this.logger.error(
        {
          message: `${request.method} ${request.url} - ${status}`,
          correlationId,
          userId,
          error:
            exception instanceof Error
              ? exception.stack
              : String(exception),
          statusCode: status,
        },
        'HttpException',
      );
    } else if (status >= 400) {
      this.logger.warn(
        {
          message: `${request.method} ${request.url} - ${status}`,
          correlationId,
          userId,
          statusCode: status,
        },
        'HttpException',
      );
    }

    response.status(status).json(errorResponse);
  }
}
