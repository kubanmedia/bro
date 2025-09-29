/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('./client.js', () => ({
  createGrokClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          // Async iterator yielding two deltas
          async *[Symbol.asyncIterator]() {
            yield { choices: [{ delta: { content: 'Hel' } }] } as any;
            yield { choices: [{ delta: { content: 'lo' } }] } as any;
          },
        }),
      },
    },
  }),
}));

import { GrokContentGenerator } from './contentGenerator.js';

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('GrokContentGenerator stream', () => {
  it('yields text chunks in order', async () => {
    const gen = new GrokContentGenerator('grok-beta');
    const stream = await gen.generateContentStream(
      {
        model: 'grok-beta',
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] } as any],
      } as any,
      'pid',
    );
    const chunks = await collect(stream);
    const texts = chunks.map(
      (c: any) => c.candidates?.[0]?.content?.parts?.[0]?.text || '',
    );
    expect(texts.join('')).toBe('Hello');
  });
});
