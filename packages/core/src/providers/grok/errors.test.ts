/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { normalizeProviderError } from './errors.js';

describe('normalizeProviderError', () => {
  it('maps 401/403 to friendly key error', () => {
    expect(normalizeProviderError({ status: 401 }).message).toMatch(/API key/i);
    expect(normalizeProviderError({ status: 403 }).message).toMatch(/API key/i);
  });
  it('maps 429', () => {
    expect(normalizeProviderError({ status: 429 }).message).toMatch(
      /rate limited/,
    );
  });
  it('maps 5xx', () => {
    expect(normalizeProviderError({ status: 503 }).message).toMatch(
      /servers might be down/,
    );
  });
  it('passes through message otherwise', () => {
    expect(normalizeProviderError(new Error('boom')).message).toBe('boom');
  });
});
