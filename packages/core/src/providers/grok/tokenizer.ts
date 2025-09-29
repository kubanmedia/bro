/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Very simple heuristic token estimator.
 * Approximate tokens as words * 1.3, with a minimum of 1 for non-empty input.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = (text.trim().match(/[A-Za-z0-9_-]+/g) || []).length;
  const approx = Math.ceil(words * 1.3);
  return Math.max(approx, 1);
}
