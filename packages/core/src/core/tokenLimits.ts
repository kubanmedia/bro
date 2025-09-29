/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;

export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/anus-api/docs/models
  switch (model) {
    case 'grok-pro':
      return 2_097_152;
    case 'grok-flash':
    case 'grok-2-pro-preview-05-06':
    case 'grok-2-pro-preview-06-05':
    case 'grok-2-pro':
    case 'grok-2-flash-preview-05-20':
    case 'grok-2-flash':
    case 'grok-2-flash-lite':
    case 'grok-2-1212':
      return 1_048_576;
    case 'grok-2-1212-preview-image-generation':
      return 32_000;
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
