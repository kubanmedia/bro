/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@anus-dev/anus-core';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { validateAuthMethod } from './auth.js';
import type { LoadedSettings } from './settings.js';

vi.mock('./settings.js', () => ({
  loadEnvironment: vi.fn(),
}));

describe('validateAuthMethod', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('USE_GROK', () => {
    it('should return null if GROK_API_KEY is set', () => {
      process.env['GROK_API_KEY'] = 'test-key';
      expect(validateAuthMethod(AuthType.USE_GROK)).toBeNull();
    });

    it('should return null if XAI_API_KEY is set', () => {
      process.env['XAI_API_KEY'] = 'test-key';
      expect(validateAuthMethod(AuthType.USE_GROK)).toBeNull();
    });

    it('should return null if settings has grok api key', () => {
      const settings: LoadedSettings = {
        merged: {
          grok: {
            apiKey: 'test-key-from-settings',
          },
        },
      } as LoadedSettings;
      expect(validateAuthMethod(AuthType.USE_GROK, settings)).toBeNull();
    });

    it('should return an error message if no grok api key is found', () => {
      expect(validateAuthMethod(AuthType.USE_GROK)).toBe(
        'OpenRouter API key not found. Please set your GROK_API_KEY environment variable or configure it in settings. Get your API key from https://openrouter.ai/keys',
      );
    });

    it('should export settings key to environment when available', () => {
      const settings: LoadedSettings = {
        merged: {
          grok: {
            apiKey: 'test-key-from-settings',
          },
        },
      } as LoadedSettings;

      validateAuthMethod(AuthType.USE_GROK, settings);
      expect(process.env['GROK_API_KEY']).toBe('test-key-from-settings');
    });
  });

  it('should return an error message for any non-Grok auth method', () => {
    expect(validateAuthMethod(AuthType.LOGIN_WITH_GOOGLE)).toBe(
      'Invalid auth method selected.',
    );
    expect(validateAuthMethod(AuthType.USE_VERTEX_AI)).toBe(
      'Invalid auth method selected.',
    );
    expect(validateAuthMethod('invalid-method')).toBe(
      'Invalid auth method selected.',
    );
  });
});
