/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Minimal provider-specific types to help map OpenAI-style tool_calls
export interface OpenAIToolCall {
  id?: string;
  type?: 'function';
  function: { name: string; arguments?: string };
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  name?: string;
}
