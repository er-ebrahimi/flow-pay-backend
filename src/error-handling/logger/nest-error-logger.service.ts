import { Injectable, Logger } from '@nestjs/common';
import { ErrorLogger } from './error-logger.interface.js';

@Injectable()
export class NestErrorLoggerService implements ErrorLogger {
  private readonly logger = new Logger('ExceptionsHandler');

  log(error: unknown, response: object): void {
    this.logger.error(JSON.stringify(response), error instanceof Error ? error.stack : '');
  }
}
