/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { estimateTokens } from './tokenizer.js';

describe('estimateTokens', () => {
  it('handles empty', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('counts words approx', () => {
    expect(estimateTokens('hello world')).toBeGreaterThanOrEqual(2);
  });
  it('handles unicode and symbols', () => {
    expect(estimateTokens('Привет, мир! 🚀')).toBeGreaterThanOrEqual(1);
  });
});
