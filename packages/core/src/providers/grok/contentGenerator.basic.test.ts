/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';

// Mock openai client used inside GrokContentGenerator
vi.mock('./client.js', () => ({
  createGrokClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello from Grok' } }],
        }),
      },
    },
  }),
  resolveGrokApiKey: vi.fn().mockReturnValue('test-api-key'),
}));

import { GrokContentGenerator } from './contentGenerator.js';
import type { GenerateContentParameters } from '@google/genai';

describe('GrokContentGenerator basic chat', () => {
  it('returns a non-streaming response mapped to GenerateContentResponse', async () => {
    const gen = new GrokContentGenerator('grok-beta', 'test-key');
    const req: GenerateContentParameters = {
      model: 'grok-beta',
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] } as any],
    } as any;
    const res = await gen.generateContent(req, 'pid');
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
    expect(text).toBe('Hello from Grok');
  });
});
