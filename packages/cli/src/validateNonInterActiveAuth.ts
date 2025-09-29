/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, Config } from '@anus-dev/anus-core';

export async function validateNonInteractiveAuth(
  configuredAuthType: AuthType | undefined,
  useExternalAuth: boolean | undefined,
  nonInteractiveConfig: Config,
) {
  // Check for Grok API key
  const hasGrokKey = !!process.env['GROK_API_KEY'];
  const isGrokAuth = configuredAuthType === AuthType.USE_GROK;

  if (hasGrokKey || isGrokAuth) {
    await nonInteractiveConfig.refreshAuth(AuthType.USE_GROK);
    return nonInteractiveConfig;
  }

  // No Grok key found
  console.error(
    'Please set your GROK_API_KEY environment variable (OpenRouter API key). Get your API key from https://openrouter.ai/keys',
  );
  process.exit(1);
}
