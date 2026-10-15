import { describe, expect, it, vi } from 'vitest';
import { googleIdentityCodeConfig } from './googleIdentity.js';

describe('Google sign-in authorization', () => {
  it('requests identity only without inherited Google API grants', () => {
    const callback = vi.fn();

    expect(googleIdentityCodeConfig('client-id', callback)).toEqual({
      client_id: 'client-id',
      scope: 'openid email profile',
      include_granted_scopes: false,
      ux_mode: 'popup',
      callback,
    });
  });
});
