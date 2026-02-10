import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';
import { redactSensitiveData } from '../logger/logger.utils';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body } = request;
    const correlationId = request[CORRELATION_ID_HEADER];
    const userId = request.user?.['sub'];
    const startTime = Date.now();

    this.logger.debug?.(
      {
        message: `Incoming ${method} ${url}`,
        correlationId,
        userId,
        body:
          Object.keys(body || {}).length > 0
            ? redactSensitiveData(body)
            : undefined,
      },
      'HTTP',
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          this.logger.log(
            {
              message: `${method} ${url} - ${response.statusCode} (${durationMs}ms)`,
              correlationId,
              userId,
              durationMs,
            },
            'HTTP',
          );
        },
        error: () => {
          const durationMs = Date.now() - startTime;
          this.logger.debug?.(
            {
              message: `${method} ${url} failed after ${durationMs}ms`,
              correlationId,
              userId,
              durationMs,
            },
            'HTTP',
          );
        },
      }),
    );
  }
}
