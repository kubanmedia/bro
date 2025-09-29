/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@anus-dev/anus-core';
import { loadEnvironment, LoadedSettings } from './settings.js';

export const validateAuthMethod = (
  authMethod: string,
  settings?: LoadedSettings,
): string | null => {
  loadEnvironment();

  if (authMethod === AuthType.USE_GROK) {
    // Check both environment variable and settings
    const hasEnvKey =
      !!process.env['GROK_API_KEY'] || !!process.env['XAI_API_KEY'];
    const hasSettingsKey = !!settings?.merged.grok?.apiKey;

    // If we have a settings key, ensure it gets exported to environment
    if (hasSettingsKey && !hasEnvKey) {
      process.env['GROK_API_KEY'] = settings!.merged.grok!.apiKey;
    }

    if (!hasEnvKey && !hasSettingsKey) {
      return 'OpenRouter API key not found. Please set your GROK_API_KEY environment variable or configure it in settings. Get your API key from https://openrouter.ai/keys';
    }
    return null;
  }

  return 'Invalid auth method selected.';
};
