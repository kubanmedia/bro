/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import { debugLog } from './debug-logger.js';

// Use OpenRouter's API endpoint for Grok models
export const DEFAULT_GROK_BASE_URL = 'https://openrouter.ai/api/v1';

/** Resolve the Grok API key from explicit arg or env var. */
export function resolveGrokApiKey(explicit?: string): string | undefined {
  return explicit ?? process.env['GROK_API_KEY'] ?? process.env['XAI_API_KEY'];
}

/** Resolve the Grok base URL from env or fallback to default. */
export function resolveGrokBaseURL(): string {
  return process.env['GROK_BASE_URL'] || DEFAULT_GROK_BASE_URL;
}

/** Create an OpenAI-compatible client configured for Grok via OpenRouter. */
export function createGrokClient(apiKey?: string): OpenAI {
  const key = resolveGrokApiKey(apiKey);
  debugLog('request', 'Creating client with config', {
    providedApiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
    resolvedApiKey: key ? `${key.substring(0, 10)}...` : 'none',
    envGROK: process.env['GROK_API_KEY'] ? 'set' : 'unset',
    baseURL: resolveGrokBaseURL(),
  });
  const client = new OpenAI({
    apiKey: key,
    baseURL: resolveGrokBaseURL(),
    timeout: 360_000, // 6 minutes
  });
  debugLog('request', 'Client created', {
    hasApiKey: (client as any).apiKey
      ? `${(client as any).apiKey.substring(0, 10)}...`
      : 'undefined',
  });
  return client;
}

export type GrokClient = OpenAI;
