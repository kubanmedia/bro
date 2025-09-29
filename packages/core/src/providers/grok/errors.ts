/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export function normalizeProviderError(err: unknown): Error {
  // Normalize known HTTP-like errors
  const e = err as any;
  const status = e?.status ?? e?.response?.status ?? e?.code;
  const message = e?.message || String(err);

  if (status === 401 || status === 403) {
    return new Error(
      'Grok authentication failed - check your API key. Get one at https://openrouter.ai/keys',
    );
  }
  if (status === 429) {
    return new Error(
      'Grok is taking a breather (rate limited). Try again in a moment.',
    );
  }
  if (Number(status) >= 500 && Number(status) < 600) {
    return new Error(
      'Cannot connect to Grok - the servers might be down. Please retry.',
    );
  }

  // Try to detect OpenAI-like errors
  const type = e?.error?.type;
  if (type === 'insufficient_quota') {
    return new Error(
      'ANUS quota exceeded - time to top up or switch to a different Grok model.',
    );
  }

  return new Error(message);
}
