import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

/**
 * Builds a guard against real Reflector semantics: public handlers carry the
 * `@Public()` metadata, non-public handlers carry none (which makes getAllAndOverride
 * resolve to undefined). Only the passport-delegation branch touches http, so
 * the fake context returns a request without headers and expects failure.
 */
function contextFor(isPublic: boolean): ExecutionContext {
  const handler = {};
  if (isPublic) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);

  return {
    getHandler: () => handler,
    getClass: () => handler,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard.canActivate', () => {
  it('lets @Public() handlers through without attempting authentication', () => {
    const guard = new JwtAuthGuard(new Reflector());

    expect(guard.canActivate(contextFor(true))).toBe(true);
  });

  it('attempts authentication for handlers without @Public()', async () => {
    const guard = new JwtAuthGuard(new Reflector());
    const context = contextFor(false);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(Error);
  });
});
