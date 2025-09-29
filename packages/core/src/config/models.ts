/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Primary model used for main conversations, complex tasks, and general interactions
export const DEFAULT_PRIMARY_MODEL = 'x-ai/grok-code-fast-1';

// Fallback model used when primary model hits rate limits or fails
// Also used for loop detection and error recovery scenarios
export const DEFAULT_FALLBACK_MODEL = 'x-ai/grok-4';

// Lightweight model used for simple tasks like edit correction and quick operations
// Optimized for speed and cost efficiency over complex reasoning
export const DEFAULT_LIGHTWEIGHT_MODEL = 'x-ai/grok-4';

// Embedding model for text embeddings (currently using Anus as Grok doesn't have embeddings)
export const DEFAULT_EMBEDDING_MODEL = 'grok-embedding-001';
