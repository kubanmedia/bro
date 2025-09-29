/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGrokClient, resolveGrokApiKey } from './client.js';

const OLD_ENV = process.env;

describe('Grok client wiring', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env['GROK_API_KEY'];
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('resolveGrokApiKey prefers explicit over envs', () => {
    process.env['GROK_API_KEY'] = 'env-key';
    expect(resolveGrokApiKey('explicit')).toBe('explicit');
  });

  it('resolveGrokApiKey falls back to GROK_API_KEY', () => {
    expect(resolveGrokApiKey()).toBeUndefined();
    process.env['GROK_API_KEY'] = 'grok';
    expect(resolveGrokApiKey()).toBe('grok');
  });

  it('createGrokClient returns a client (smoke)', () => {
    const client = createGrokClient('abc');
    expect(client).toBeTruthy();
  });
});
