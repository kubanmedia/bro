/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { toFunctionCallPart, toOpenAITools } from './tools.js';

describe('toFunctionCallPart', () => {
  it('parses valid JSON args', () => {
    const p = toFunctionCallPart('sum', '{"a":1,"b":2}', 'id-1');
    // @ts-expect-error testing shape
    expect(p.functionCall.name).toBe('sum');
    // @ts-expect-error testing shape
    expect(p.functionCall.args).toEqual({ a: 1, b: 2 });
    // @ts-expect-error testing shape
    expect(p.functionCall.id).toBe('id-1');
  });

  it('handles invalid JSON without throwing', () => {
    const p = toFunctionCallPart('sum', '{"a":1,', 'id-2');
    // @ts-expect-error testing shape
    expect(p.functionCall.name).toBe('sum');
    // @ts-expect-error testing shape
    expect(p.functionCall.args).toEqual({});
  });
});

describe('Tool Name Preservation', () => {
  it('should preserve exact tool names end-to-end', () => {
    const genaiTools = [
      {
        name: 'chrome_navigate',
        description: 'Navigate to a URL or refresh the current tab',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
      {
        name: 'chrome_get_interactive_elements',
        description: 'Get interactive elements from current page',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];

    const openaiTools = toOpenAITools(genaiTools);

    expect(openaiTools).toBeDefined();
    expect(openaiTools!).toHaveLength(3);

    // Verify exact name preservation
    expect(openaiTools![0].function.name).toBe('chrome_navigate');
    expect(openaiTools![1].function.name).toBe('write_file');
    expect(openaiTools![2].function.name).toBe(
      'chrome_get_interactive_elements',
    );

    // Verify structure is correct
    expect(openaiTools![0].type).toBe('function');
    expect(openaiTools![0].function).toHaveProperty('name');
    expect(openaiTools![0].function).toHaveProperty('description');
    expect(openaiTools![0].function).toHaveProperty('parameters');
  });

  it('should preserve snake_case names without transformation', () => {
    const toolsWithSnakeCase = [
      { name: 'read_many_files' },
      { name: 'run_shell_command' },
      { name: 'chrome_fill_or_select' },
      { name: 'list_directory' },
    ];

    const openaiTools = toOpenAITools(toolsWithSnakeCase);

    expect(openaiTools).toBeDefined();
    expect(openaiTools!).toHaveLength(4);

    const resultNames = openaiTools!.map((tool) => tool.function.name);
    expect(resultNames).toEqual([
      'read_many_files',
      'run_shell_command',
      'chrome_fill_or_select',
      'list_directory',
    ]);
  });

  it('should handle tools with functionDeclarations wrapper', () => {
    const toolsWithWrapper = [
      {
        functionDeclarations: [
          {
            name: 'chrome_click_element',
            description: 'Click an element',
            parametersJsonSchema: { type: 'object', properties: {} },
          },
          {
            name: 'edit_file',
            description: 'Edit a file',
            parametersJsonSchema: { type: 'object', properties: {} },
          },
        ],
      },
    ];

    const openaiTools = toOpenAITools(toolsWithWrapper);

    expect(openaiTools).toBeDefined();
    expect(openaiTools!).toHaveLength(2);

    expect(openaiTools![0].function.name).toBe('chrome_click_element');
    expect(openaiTools![1].function.name).toBe('edit_file');
  });

  it('should handle empty or undefined tools', () => {
    expect(toOpenAITools([])).toBeUndefined();
    expect(toOpenAITools(undefined)).toBeUndefined();
    expect(toOpenAITools(null)).toBeUndefined();
  });
});
