import {
  Injectable,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from './monitoring.service';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly monitoringService: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const duration = (Date.now() - start) / 1000;
          this.monitoringService.recordRequest(
            method,
            url,
            res.statusCode,
            duration,
          );
        },
        error: (err: { status?: number }) => {
          const statusCode = err.status ?? 500;
          const duration = (Date.now() - start) / 1000;
          this.monitoringService.recordRequest(
            method,
            url,
            statusCode,
            duration,
          );
        },
      }),
    );
  }
}
