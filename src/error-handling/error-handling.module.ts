import { DynamicModule, Provider, Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { GlobalExceptionFilter } from './filter/global-exception.filter.js';
import { ErrorLogger } from './logger/error-logger.interface.js';
import { NestErrorLoggerService } from './logger/nest-error-logger.service.js';
import { ErrorMapper } from './mappers/error-mapper.interface.js';
import { AppExceptionMapper } from './mappers/app-exception.mapper.js';
import { ValidationPipeMapper } from './mappers/validation-pipe.mapper.js';
import { HttpExceptionMapper } from './mappers/http-exception.mapper.js';
import { DefaultMapper } from './mappers/default.mapper.js';
import { ERROR_LOGGER, ERROR_MAPPERS, IS_PRODUCTION } from './tokens/tokens.js';

/**
 * Default precedence: domain-first, then the narrow validation mapping,
 * then general Nest HttpExceptions, catch-all last.
 */
const DEFAULT_MAPPERS: ErrorMapper[] = [
  new AppExceptionMapper(),
  new ValidationPipeMapper(),
  new HttpExceptionMapper(),
  new DefaultMapper(),
];

/** Accepted custom entry: either a ready instance or an instantiable class. */
export type CustomMapperProvider = ErrorMapper | Type<ErrorMapper> | Provider;

export interface ErrorHandlingOptions {
  /** Extra mappers; they are consulted before the built-in defaults. */
  mappers?: CustomMapperProvider[];
  /** Default: NestErrorLoggerService. Constructor takes no arguments. */
  loggerClass?: Type<ErrorLogger>;
}

export class ErrorHandlingModule {
  /**
   * Mounts the global filter, default and custom mappers, and the error logger
   * as a single global dynamic module.
   *
   * @param options Optional configuration: `mappers` are consulted before the
   *   built-in defaults (first `supports()` wins); `loggerClass` replaces the
   *   default Nest logger.
   */
  static forRoot(options: ErrorHandlingOptions = {}): DynamicModule {
    const mappers: ErrorMapper[] = [
      ...(options.mappers ?? []).map(resolveMapper),
      ...DEFAULT_MAPPERS,
    ];
    const loggerClass = options.loggerClass ?? NestErrorLoggerService;

    return {
      module: ErrorHandlingModule,
      global: true,
      providers: [
        loggerClass,
        { provide: ERROR_LOGGER, useClass: loggerClass },
        { provide: ERROR_MAPPERS, useValue: mappers },
        { provide: IS_PRODUCTION, useFactory: isProduction },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
      exports: [ERROR_LOGGER],
    };
  }
}

/**
 * The single controlled process.env read in this module; everything downstream
 * sees the resolved boolean instead.
 */
function isProduction(): boolean {
  return process.env['NODE_ENV'] !== 'development';
}

function resolveMapper(entry: CustomMapperProvider): ErrorMapper {
  if (isClass(entry)) return new entry();
  if (isValueProvider(entry)) return entry.useValue as ErrorMapper;
  if (isClassProvider(entry)) return new (entry.useClass as Type<ErrorMapper>)();
  throw new Error(
    'ErrorHandlingModule.forRoot: custom mappers must be an ErrorMapper instance ' +
      'or an instantiable class. useFactory/useExisting providers are not supported.',
  );
}

function isClass(value: CustomMapperProvider): value is Type<ErrorMapper> {
  return typeof value === 'function';
}

function isValueProvider(
  value: CustomMapperProvider,
): value is Extract<Provider, { useValue: unknown }> {
  return typeof value === 'object' && value !== null && 'useValue' in value;
}

function isClassProvider(
  value: CustomMapperProvider,
): value is Extract<Provider, { useClass: Type<unknown> }> {
  return typeof value === 'object' && value !== null && 'useClass' in value;
}
