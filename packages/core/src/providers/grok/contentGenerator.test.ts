/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrokContentGenerator } from './contentGenerator.js';

// Mock the imports
vi.mock('./client.js');
vi.mock('./tools.js');
vi.mock('./debug-logger.js');
vi.mock('./openai-stream.js');
vi.mock('./errors.js');

describe('GrokContentGenerator Tool Prioritization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create GrokContentGenerator instance', () => {
    const contentGenerator = new GrokContentGenerator(
      'x-ai/grok-code-fast-1',
      'test-key',
    );
    expect(contentGenerator).toBeDefined();
  });

  it('should have tool filter functionality available', async () => {
    const { filterAndPrioritizeTools } = await import('./tool-filter.js');
    expect(filterAndPrioritizeTools).toBeDefined();
  });
});
