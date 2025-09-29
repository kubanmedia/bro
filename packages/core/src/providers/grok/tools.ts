/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Part,
  FunctionCall,
  Content,
  FunctionDeclaration,
} from '@google/genai';
import { debugLog } from './debug-logger.js';

export type OpenAIStreamToolDelta = {
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
};

export type ToolBuilder = {
  id?: string;
  name?: string;
  argsText: string;
  emitted: boolean;
};

/**
 * Minify tool descriptions to reduce payload size - AGGRESSIVE VERSION
 */
function minifyDescription(description: string): string {
  if (!description) return '';

  // Ultra-compressed descriptions (5-8 chars max)
  const ultraMinMap: Record<string, string> = {
    'Lists the names of files and subdirectories directly within a specified directory path. Can optionally ignore entries matching provided glob patterns.':
      'ls',
    'Writes content to a specified file in the local filesystem.': 'write',
    'Reads and returns the content of a specified file. If the file is large, the content will be truncated.':
      'read',
    'Replaces text within a file. By default, replaces a single occurrence, but can replace multiple occurrences when `expected_replacements` is specified.':
      'edit',
    'This tool executes a given shell command as `bash -c <command>`.': 'bash',
    'Navigate to a URL or refresh the current tab': 'nav',
    'Searches for a regular expression pattern within the content of files in a specified directory':
      'grep',
    'Efficiently finds files matching specific glob patterns': 'find',
    'Performs a web search using Google Search': 'search',
    'Processes content from URL(s), including local and private network addresses':
      'fetch',
    'Reads content from multiple files specified by paths or glob patterns':
      'readm',
    'Saves a specific piece of information or fact to your long-term memory':
      'memo',
  };

  // Check for exact matches first
  if (ultraMinMap[description]) {
    return ultraMinMap[description];
  }

  // For other descriptions, ultra-aggressive truncation to 8 chars max
  return description.length > 8 ? description.substring(0, 8) : description;
}

/**
 * Compact JSON schema by removing descriptions and unnecessary properties - ULTRA AGGRESSIVE
 */
function compactSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  if (Array.isArray(schema)) {
    return schema.map(compactSchema);
  }

  const compacted: any = {};

  // Keep only absolutely essential properties
  for (const [key, value] of Object.entries(schema)) {
    switch (key) {
      case 'type':
      case 'properties':
      case 'required':
        if (key === 'properties' && value && typeof value === 'object') {
          // Compact nested properties - keep only type
          compacted[key] = {};
          for (const [propKey, propValue] of Object.entries(value)) {
            const compactProp = compactSchema(propValue);
            // For properties, keep only 'type' field if it exists
            if (compactProp && compactProp.type) {
              compacted[key][propKey] = { type: compactProp.type };
            } else {
              compacted[key][propKey] = compactProp;
            }
          }
        } else {
          compacted[key] = value;
        }
        break;
      case 'items': {
        // Recursively compact items but only keep essential fields
        const compactedItems = compactSchema(value);
        if (compactedItems && compactedItems.type) {
          compacted[key] = { type: compactedItems.type };
        } else {
          compacted[key] = compactedItems;
        }
        break;
      }
      case 'description':
      case 'examples':
      case 'default':
      case 'format':
      case 'pattern':
      case 'minimum':
      case 'maximum':
      case 'minLength':
      case 'maxLength':
      case 'enum':
        // Skip all non-essential fields to drastically reduce payload
        break;
      default:
        // Skip everything else except core structure
        break;
    }
  }

  return compacted;
}

export function toFunctionCallPart(
  name: string,
  argsText: string,
  callId?: string,
): Part {
  let args: unknown = {};
  try {
    args = argsText ? JSON.parse(argsText) : {};
  } catch {
    // Keep as empty object if not valid JSON yet
  }
  const fn: FunctionCall = { id: callId, name, args } as FunctionCall;
  return { functionCall: fn } as Part;
}

/**
 * Convert a Google GenAI FunctionDeclaration[] or Tool[] into OpenAI-compatible tools list.
 */
export function toOpenAITools(genaiTools?: unknown): any[] | undefined {
  if (!genaiTools) return undefined;

  // Flatten possible shapes: Tool[] (with functionDeclarations/_declarations) or FunctionDeclaration[]
  const out: any[] = [];
  const maybeArray = Array.isArray(genaiTools) ? genaiTools : [];

  for (const t of maybeArray as any[]) {
    // Tool shape with function declarations
    const fns: FunctionDeclaration[] =
      (t?.functionDeclarations as FunctionDeclaration[]) ||
      (t?.function_declarations as FunctionDeclaration[]) ||
      (Array.isArray(t?.name) ? [] : undefined);

    if (Array.isArray(fns) && fns.length > 0) {
      for (const fn of fns) {
        out.push(toOpenAIFunction(fn));
      }
      continue;
    }

    // FunctionDeclaration directly
    if (
      t &&
      typeof t === 'object' &&
      'name' in t &&
      !('functionDeclarations' in t)
    ) {
      out.push(toOpenAIFunction(t as FunctionDeclaration));
      continue;
    }
  }

  return out.length > 0 ? out : undefined;
}

function toOpenAIFunction(fn: FunctionDeclaration): any {
  const name = fn.name;
  const originalDescription = (fn as any).description || '';
  const description = minifyDescription(originalDescription);

  // Parameters may be under parametersJsonSchema or parameters
  const originalParameters = (fn as any).parametersJsonSchema ||
    (fn as any).parameters || {
      type: 'object',
      properties: {},
    };

  const parameters = compactSchema(originalParameters);

  return {
    type: 'function',
    function: {
      name,
      description,
      parameters,
    },
  };
}

/**
 * Translate Google GenAI history (Content[]) into OpenAI-compatible messages,
 * including mapping functionResponse parts into 'tool' messages and
 * functionCall parts into assistant messages with tool_calls. If a
 * systemInstruction is provided, prepend a system message.
 */
export function mapGenAIContentsToOpenAIMessages(
  contents: Content | Content[] | undefined,
  systemInstruction?: string,
): Array<{
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
}> {
  debugLog('mapping', 'Starting message mapping', {
    hasContents: !!contents,
    hasSystemInstruction: !!systemInstruction,
  });

  const messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string;
    tool_call_id?: string;
    name?: string;
    tool_calls?: any[];
  }> = [];
  if (systemInstruction)
    messages.push({ role: 'system', content: systemInstruction });
  if (!contents) return messages;

  const arr = Array.isArray(contents) ? contents : [contents];
  debugLog('mapping', `Processing ${arr.length} content items`);

  for (const c of arr) {
    const role = (c as any)?.role;
    const parts = (c as any)?.parts as any[] | undefined;
    if (!Array.isArray(parts)) continue;

    debugLog(
      'mapping',
      `Processing content with role: ${role}, parts: ${parts.length}`,
    );

    // If all parts are functionResponse, emit tool messages
    const allFnResponses =
      parts.length > 0 && parts.every((p) => !!p.functionResponse);
    if (allFnResponses) {
      debugLog('mapping', 'Processing function responses');
      for (const p of parts) {
        const fr = p.functionResponse;
        if (!fr) continue;
        messages.push({
          role: 'tool',
          tool_call_id: fr.id ?? undefined,
          name: fr.name ?? undefined,
          content:
            typeof fr.response === 'string'
              ? fr.response
              : JSON.stringify(fr.response ?? {}),
        });
      }
      continue;
    }

    // Extract text and function calls
    const text = parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('');

    // Extract function calls for assistant messages
    const functionCalls = parts
      .filter((p) => !!p.functionCall)
      .map((p) => p.functionCall);

    if (functionCalls.length > 0) {
      debugLog(
        'mapping',
        `Found ${functionCalls.length} function calls`,
        functionCalls,
      );
    }

    if (role === 'user') {
      messages.push({ role: 'user', content: text });
    } else if (role === 'model') {
      // For assistant messages, include tool_calls if there are function calls
      const message: any = { role: 'assistant', content: text };

      if (functionCalls.length > 0) {
        message.tool_calls = functionCalls.map((fc: any) => ({
          id: fc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: {
            name: fc.name,
            arguments:
              typeof fc.args === 'string'
                ? fc.args
                : JSON.stringify(fc.args || {}),
          },
        }));
        debugLog(
          'mapping',
          'Added tool_calls to assistant message',
          message.tool_calls,
        );
      }

      messages.push(message);
    }
  }

  debugLog('mapping', `Mapped to ${messages.length} OpenAI messages`);
  return messages;
}
