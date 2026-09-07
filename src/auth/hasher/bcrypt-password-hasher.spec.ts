import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { BcryptPasswordHasher } from './bcrypt-password-hasher.js';

/**
 * The credential gate depends on an external primitive (bcryptjs), so the
 * round-trip behavior — hash determinism, verify false negatives, wrong
 * passwords rejected — is pinned here in addition to the e2e login flow.
 */
describe('BcryptPasswordHasher', () => {
  let hasher: BcryptPasswordHasher;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BcryptPasswordHasher, { provide: ConfigService, useValue: null }],
    }).compile();
    hasher = await moduleRef.resolve(BcryptPasswordHasher);
  });

  it('verifies a password against its own hash', async () => {
    const hash = await hasher.hash('hunter2hunter2');
    expect(hash).not.toBe('hunter2hunter2');
    await expect(hasher.verify('hunter2hunter2', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password and never returns the hash match', async () => {
    const hash = await hasher.hash('hunter2hunter2');
    await expect(hasher.verify('wrong-password-42', hash)).resolves.toBe(false);
  });

  it('produces different hashes for the same password (always salted)', async () => {
    const a = await hasher.hash('same-password-8');
    const b = await hasher.hash('same-password-8');
    expect(a).not.toBe(b);
    await expect(hasher.verify('same-password-8', a)).resolves.toBe(true);
    await expect(hasher.verify('same-password-8', b)).resolves.toBe(true);
  });
});
