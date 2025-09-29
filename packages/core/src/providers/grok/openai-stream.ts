/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type OpenAI from 'openai';
import type {
  GenerateContentResponse,
  Part,
  FunctionCall,
} from '@google/genai';
import type { OpenAIStreamToolDelta } from './tools.js';
import { debugLog, logStreamChunk } from './debug-logger.js';

/** Map a text delta into a GenerateContentResponse chunk. */
function textChunk(text: string): GenerateContentResponse {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text } as unknown as Part],
        } as any,
      } as any,
    ],
  } as GenerateContentResponse;
}

function functionCallResponse(
  id: string | undefined,
  name: string,
  args: unknown,
): GenerateContentResponse {
  const fn: FunctionCall = { id, name, args } as FunctionCall;
  const content = {
    role: 'model',
    parts: [{ functionCall: fn } as unknown as Part],
  } as any;
  return {
    candidates: [{ content } as any],
    functionCalls: [fn],
  } as GenerateContentResponse as any;
}

/**
 * Accumulates tool_calls deltas by index and emits a FunctionCall once JSON args are valid.
 */
class ToolCallAssembler {
  private builders = new Map<
    number,
    { id?: string; name?: string; argsText: string; emitted: boolean }
  >();

  update(delta: OpenAIStreamToolDelta): GenerateContentResponse | null {
    const idx = delta.index ?? 0;
    const b = this.builders.get(idx) ?? { argsText: '', emitted: false };
    if (delta.id) b.id = delta.id;
    if (delta.function?.name) b.name = delta.function.name;
    if (typeof delta.function?.arguments === 'string') {
      b.argsText += delta.function.arguments;
    }
    this.builders.set(idx, b);

    // Only log tool call deltas if there's an actual function name or error
    if (b.name || delta.function?.name) {
      debugLog(
        'tool',
        `Tool call delta: index=${idx}, name=${b.name}, hasId=${!!b.id}, argsLength=${b.argsText.length}`,
      );
    }

    // Only emit when we have a name and parseable JSON args and haven't emitted yet
    if (!b.emitted && b.name) {
      try {
        const args = b.argsText ? JSON.parse(b.argsText) : {};
        b.emitted = true;
        this.builders.set(idx, b);
        debugLog('tool', `Emitting tool call: ${b.name}`, { id: b.id, args });
        return functionCallResponse(b.id, b.name, args);
      } catch {
        // Not yet valid JSON; keep buffering - only log occasionally to avoid spam
        if (b.argsText.length % 100 === 0) {
          debugLog(
            'tool',
            `Buffering incomplete JSON for tool: ${b.name}, length: ${b.argsText.length}`,
          );
        }
      }
    }
    return null;
  }
}

/**
 * Parse Grok's XML-like tool call format from text content
 * Example: <xai:function_call name="write_file"><parameter name="file_path">...</parameter><parameter name="content">...</parameter></xai:function_call>
 */
function parseGrokXMLToolCall(text: string): FunctionCall | null {
  // Only log when actually parsing, not just checking
  // debugLog('tool', 'Checking for Grok XML tool call in text', { textLength: text.length });

  // Check if text contains Grok's XML-like tool call format
  const functionCallMatch = text.match(
    /<xai:function_call\s+name="([^"]+)">(.*?)<\/xai:function_call>/s,
  );

  if (!functionCallMatch) {
    return null;
  }

  const [, functionName, parametersXML] = functionCallMatch;
  debugLog('tool', 'Found Grok XML tool call', {
    functionName,
    parametersLength: parametersXML.length,
  });

  // Parse parameters from XML format (handle multiline content)
  const parameterRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
  const args: Record<string, any> = {};

  let match;
  while ((match = parameterRegex.exec(parametersXML)) !== null) {
    const [, paramName, paramValue] = match;
    // Decode any HTML entities that might be in the value
    const decodedValue = paramValue
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    // Try to parse as JSON if it looks like JSON
    try {
      if (
        decodedValue.trim().startsWith('{') ||
        decodedValue.trim().startsWith('[')
      ) {
        args[paramName] = JSON.parse(decodedValue);
      } else {
        args[paramName] = decodedValue;
      }
    } catch {
      args[paramName] = decodedValue;
    }
  }

  debugLog('tool', 'Parsed Grok XML tool call', { functionName, args });

  return {
    id: `call_${Math.random().toString(36).substr(2, 9)}`,
    name: functionName,
    args,
  } as FunctionCall;
}

/**
 * Iterate OpenAI-compatible streamed chat completions and yield GenerateContentResponse chunks.
 */
export async function* streamOpenAIChat(
  client: OpenAI,
  args: Parameters<OpenAI['chat']['completions']['create']>[0],
): AsyncGenerator<GenerateContentResponse> {
  try {
    debugLog('stream', 'Starting stream with config', {
      model: args.model,
      messagesCount: (args.messages as any[])?.length,
      firstMessage: (args.messages as any[])?.[0],
      hasTools: !!(args as any).tools,
      temperature: (args as any).temperature,
      maxTokens: (args as any).max_tokens,
      stream: (args as any).stream,
      apiKey: (client as any).apiKey ? 'present' : 'missing',
      baseURL: (client as any).baseURL,
    });

    // Only log stream start when tools are involved
    if ((args as any).tools?.length) {
      debugLog('tool', 'Starting OpenAI stream with tools', {
        model: args.model,
        messagesCount: (args.messages as any[])?.length,
        toolCount: (args as any).tools.length,
      });
    }

    // Create stream
    debugLog('stream', 'About to create stream with args', {
      args: { ...(args as any), stream: true },
    });

    const stream: AsyncIterable<any> = (await (
      client as any
    ).chat.completions.create({ ...(args as any), stream: true })) as any;
    debugLog('stream', 'Stream created successfully', {
      type: typeof stream,
      isIterable: !!(
        stream && typeof stream[Symbol.asyncIterator] === 'function'
      ),
    });

    const assembler = new ToolCallAssembler();
    let chunkCount = 0;
    let emptyChunkCount = 0;

    // Buffer for accumulating text to detect Grok XML tool calls
    let textAccumulator = '';
    let inToolCall = false;

    debugLog('stream', 'About to iterate stream', {});
    for await (const chunk of stream as any) {
      chunkCount++;
      const choice = chunk?.choices?.[0];
      const delta = choice?.delta ?? {};

      // Check if this is an empty chunk (no content, no tool calls)
      const hasContent = delta?.content && delta.content.length > 0;
      const hasToolCalls =
        Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0;

      if (!hasContent && !hasToolCalls && !choice?.finish_reason) {
        emptyChunkCount++;
        // Skip logging empty chunks to reduce noise
        continue;
      }

      // Only log chunks with tool calls or occasionally for monitoring
      if (hasToolCalls || chunkCount % 500 === 0) {
        debugLog(
          'stream',
          `Got chunk ${chunkCount} ${hasToolCalls ? '(with tools)' : '(monitoring)'}`,
          {
            chunkPreview: JSON.stringify(chunk).substring(0, 200),
          },
        );
        logStreamChunk({ chunkNumber: chunkCount, delta });
      }

      const contentDelta: string | undefined = delta?.content;
      if (typeof contentDelta === 'string' && contentDelta.length > 0) {
        // Accumulate text to check for Grok XML tool calls
        textAccumulator += contentDelta;

        // Check if we're starting a Grok XML tool call
        if (textAccumulator.includes('<xai:function_call')) {
          inToolCall = true;
          debugLog('tool', 'Detected start of Grok XML tool call');
        }

        // If we're in a tool call and see the end tag, try to parse it
        if (inToolCall && textAccumulator.includes('</xai:function_call>')) {
          debugLog(
            'tool',
            'Detected end of Grok XML tool call, attempting to parse',
          );

          const toolCall = parseGrokXMLToolCall(textAccumulator);
          if (toolCall) {
            debugLog('tool', 'Successfully parsed Grok XML tool call', {
              toolCall,
            });

            // Emit the tool call as a function call response
            yield functionCallResponse(
              toolCall.id!,
              toolCall.name!,
              toolCall.args,
            );

            // Clear the accumulator after successful parsing
            textAccumulator = '';
            inToolCall = false;
          } else {
            debugLog('tool', 'Failed to parse Grok XML tool call');
          }
        } else if (!inToolCall) {
          // Only yield text if we're not accumulating for a tool call
          // Don't log every text chunk - too verbose
          yield textChunk(contentDelta);
          textAccumulator = ''; // Clear accumulator for regular text
        }
      }

      // Also check for standard OpenAI tool calls (in case they start working)
      const toolCalls: OpenAIStreamToolDelta[] | undefined = (delta as any)
        ?.tool_calls;
      if (Array.isArray(toolCalls)) {
        debugLog(
          'tool',
          `Received ${toolCalls.length} OpenAI tool call delta(s)`,
        );
        for (const t of toolCalls) {
          const mapped = assembler.update(t);
          if (mapped) yield mapped;
        }
      }
    }

    // If stream ends while we're still accumulating text, yield it as regular text
    if (textAccumulator && !inToolCall) {
      yield textChunk(textAccumulator);
    }

    debugLog('stream', 'Stream iteration complete', {
      totalChunks: chunkCount,
      emptyChunks: emptyChunkCount,
    });
    debugLog(
      'request',
      `Stream complete. Total chunks: ${chunkCount}, empty chunks: ${emptyChunkCount}`,
    );
  } catch (error) {
    debugLog('error', 'Stream error occurred', error);
    debugLog('error', 'Stream error', error);
    throw error;
  }
}
