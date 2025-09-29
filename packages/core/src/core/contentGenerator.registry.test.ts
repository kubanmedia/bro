/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  createContentGenerator,
  Provider,
  type ContentGeneratorConfig,
} from './contentGenerator.js';
import type { Config } from '../config/config.js';

describe('ContentGenerator provider registry', () => {
  it('selects Grok provider when config.provider === GROK', async () => {
    const cfg: ContentGeneratorConfig = {
      model: 'grok-beta',
      provider: Provider.GROK,
      apiKey: 'test-key',
    };
    const fakeCoreConfig = {} as unknown as Config;
    const gen = await createContentGenerator(cfg, fakeCoreConfig, 'session-1');
    expect(gen).toBeTruthy();
  });
});
