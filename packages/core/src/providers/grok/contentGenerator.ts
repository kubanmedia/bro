/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  Content,
  Part,
} from '@google/genai';
import { ContentGenerator } from '../../core/contentGenerator.js';

import { estimateTokens } from './tokenizer.js';
import {
  debugLog,
  logApiRequest,
  logApiResponse,
  logError,
  logMessageMapping,
} from './debug-logger.js';

/**
 * Stub GrokContentGenerator to satisfy registry wiring; to be implemented in Step 3.
 */
export class GrokContentGenerator implements ContentGenerator {
  userTier = undefined;
  // Placeholder constructor (values used in later steps)
  constructor(
    private readonly model: string,
    private readonly apiKey?: string,
  ) {}

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    debugLog('request', 'generateContent called', {
      model: this.model,
      hasTools: !!(request as any)?.config?.tools,
    });

    // Non-streaming implementation using OpenAI-compatible client
    const { createGrokClient } = await import('./client.js');
    const client = createGrokClient(this.apiKey);

    try {
      const genConfig = (request as any)?.config || {};
      const wantsJson = genConfig?.responseMimeType === 'application/json';
      const jsonSchema = genConfig?.responseJsonSchema as
        | Record<string, unknown>
        | undefined;
      const systemInstruction = genConfig?.systemInstruction as
        | string
        | undefined;

      // Only log when tools are involved or there are potential issues
      if (genConfig?.tools) {
        debugLog('request', 'Request config', {
          wantsJson,
          hasSystemInstruction: !!systemInstruction,
          hasTools: !!genConfig?.tools,
        });
      }

      // Map Google GenAI history (including tool responses) to OpenAI messages
      const { mapGenAIContentsToOpenAIMessages, toOpenAITools } = await import(
        './tools.js'
      );

      // FORCE Grok to use tools by making it extremely explicit
      let enhancedSystemInstruction = systemInstruction;
      if (genConfig?.tools && !wantsJson) {
        const toolInstruction = `CRITICAL: You are in FUNCTION CALLING MODE. You MUST use the provided tools to perform actions.

STRICT RULES:
1. When asked to create/write files: IMMEDIATELY call write_file function - NO text responses
2. When asked to run commands: IMMEDIATELY call run_shell_command function - NO text responses  
3. When asked to read files: IMMEDIATELY call read_file function - NO text responses
4. When asked to edit files: IMMEDIATELY call replace function - NO text responses
5. When asked to list directories: IMMEDIATELY call list_directory function - NO text responses

TOOL CALL FORMAT:
Use this XML format for tool calls:
<xai:function_call name="TOOL_NAME">
  <parameter name="PARAM_NAME">PARAM_VALUE</parameter>
</xai:function_call>

Example for creating files:
<xai:function_call name="write_file">
  <parameter name="file_path">/path/to/file.txt</parameter>
  <parameter name="content">File content here</parameter>
</xai:function_call>

FORBIDDEN BEHAVIORS:
- DO NOT write code in your response text
- DO NOT provide plans or explanations before using tools
- DO NOT ask for permission - JUST USE THE TOOLS
- DO NOT output example code blocks

YOU MUST RESPOND WITH TOOL CALLS, NOT TEXT. USE THE XML FORMAT SHOWN ABOVE.`;

        enhancedSystemInstruction = enhancedSystemInstruction
          ? `${toolInstruction}\n\n${enhancedSystemInstruction}`
          : toolInstruction;
      }

      const rawMessages = mapGenAIContentsToOpenAIMessages(
        (request as any).contents as Content[] | Content | undefined,
        wantsJson
          ? `You are a strict JSON generator. Respond ONLY with a single valid JSON object, no prose, no markdown fences.${
              jsonSchema
                ? `\nJSON schema (for guidance only):\n${JSON.stringify(jsonSchema)}`
                : ''
            }${systemInstruction ? `\n\nAdditional instructions:\n${systemInstruction}` : ''}`
          : enhancedSystemInstruction,
      );

      // Only log message sizes when there are potential issues or tools
      const messages = rawMessages.map((msg: any) => {
        if (msg.content && (genConfig?.tools || msg.content.length > 10000)) {
          debugLog(
            'request',
            `Message size - ${msg.role}: ${msg.content.length} characters`,
          );
        }
        return msg;
      });

      logMessageMapping((request as any).contents, messages);

      const tools = toOpenAITools((genConfig as { tools?: unknown })?.tools);

      // No tool limitations - use all available tools
      const limitedTools = tools;

      // Always log tool conversion since this is critical for debugging tool issues
      if (limitedTools?.length) {
        debugLog('tool', 'Converted tools for request', {
          toolCount: limitedTools.length,
          toolNames: limitedTools.map((t: any) => t.function?.name),
        });
      }

      // TODO: Add optional debug logging for final tools sent to model if needed

      const args: Record<string, unknown> = {
        model: this.model ?? (request as any).model,
        messages,
        stream: false,
        temperature: genConfig?.temperature ?? 0.7, // Use same default as grok-cli
        max_tokens: genConfig?.maxOutputTokens ?? 4000, // Full tokens with paid account
      };

      // Only add tools if there are any
      if (limitedTools && limitedTools.length > 0) {
        args['tools'] = limitedTools;
        args['tool_choice'] = 'auto';
      }

      // For Grok models, optionally enable real-time web search
      // Commenting out for debugging - might be causing timeout
      // if ((this.model ?? (request as any).model)?.toLowerCase().includes('grok')) {
      //   (args as any).search_parameters = { mode: 'auto' };
      // }

      if (wantsJson) {
        (args as any).response_format = { type: 'json_object' };
      }

      logApiRequest('chat.completions.create', args);

      // Check for API key before making request
      const { resolveGrokApiKey } = await import('./client.js');
      const resolvedApiKey = resolveGrokApiKey(this.apiKey);
      if (!resolvedApiKey) {
        throw new Error(
          'No OpenRouter API key found. Please set GROK_API_KEY environment variable, or configure authentication via CLI settings. Get your API key from https://openrouter.ai/keys',
        );
      }

      // Call Grok chat completions
      const completion = await (client as any).chat.completions.create(args);

      logApiResponse('chat.completions.create', completion);

      const choice = (completion as any)?.choices?.[0];
      const msg = choice?.message ?? {};
      const replyText: string = msg?.content ?? '';
      const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];

      const parts: Part[] = [] as any;
      if (replyText) parts.push({ text: String(replyText) } as unknown as Part);

      if (toolCalls.length > 0) {
        const { toFunctionCallPart } = await import('./tools.js');
        for (const tc of toolCalls) {
          if (tc?.type === 'function' && tc.function?.name) {
            parts.push(
              toFunctionCallPart(
                tc.function.name,
                tc.function.arguments ?? '{}',
                tc.id,
              ),
            );
          }
        }
      }

      const response: GenerateContentResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts,
            } as any,
          } as any,
        ],
        functionCalls:
          toolCalls.length > 0
            ? toolCalls
                .filter(
                  (tc: any) => tc?.type === 'function' && tc.function?.name,
                )
                .map((tc: any) => ({
                  id: tc.id,
                  name: tc.function.name,
                  args: (() => {
                    try {
                      return JSON.parse(tc.function.arguments ?? '{}');
                    } catch {
                      return {};
                    }
                  })(),
                }))
            : undefined,
      } as GenerateContentResponse;

      // Always log tool call results since this is critical for debugging
      if (toolCalls.length > 0) {
        debugLog('tool', 'Generated tool calls in response', {
          toolCallCount: toolCalls.length,
          toolCalls: toolCalls.map((tc: any) => ({
            name: tc.function?.name,
            id: tc.id,
          })),
        });
      } else if (genConfig?.tools?.length > 0) {
        // Log when tools were expected but not called
        debugLog(
          'tool',
          'No tool calls generated despite tools being available',
          {
            hasText: !!replyText,
            availableTools: tools?.length || 0,
          },
        );
      }

      return response;
    } catch (err) {
      logError('generateContent', err);
      const { normalizeProviderError } = await import('./errors.js');
      throw normalizeProviderError(err);
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    debugLog('request', 'generateContentStream called', {
      model: this.model,
      hasApiKey: !!this.apiKey,
      requestContents: (request as any)?.contents?.length,
    });

    // Only log streaming initialization when tools are involved
    if ((request as any)?.config?.tools) {
      debugLog('tool', 'generateContentStream called with tools', {
        model: this.model,
        toolCount: (request as any)?.config?.tools?.length,
        hasApiKey: !!this.apiKey,
      });
    }

    const { createGrokClient } = await import('./client.js');
    const { streamOpenAIChat } = await import('./openai-stream.js');
    const client = createGrokClient(this.apiKey);

    const genConfig =
      (request as any)?.config || (request as any)?.generationConfig || {};
    const systemInstruction = genConfig?.systemInstruction as
      | string
      | undefined;

    // Only log stream config when tools are involved
    if (genConfig?.tools) {
      debugLog('tool', 'Stream config with tools', {
        hasSystemInstruction: !!systemInstruction,
        toolCount: genConfig.tools.length,
      });
    }

    // FORCE Grok to use tools by making it extremely explicit
    let enhancedSystemInstruction = systemInstruction;
    if (genConfig?.tools) {
      const toolInstruction = `CRITICAL: You are in FUNCTION CALLING MODE. You MUST use the provided tools to perform actions.

STRICT RULES:
1. When asked to create/write files: IMMEDIATELY call write_file function - NO text responses
2. When asked to run commands: IMMEDIATELY call run_shell_command function - NO text responses  
3. When asked to read files: IMMEDIATELY call read_file function - NO text responses
4. When asked to edit files: IMMEDIATELY call replace function - NO text responses
5. When asked to list directories: IMMEDIATELY call list_directory function - NO text responses

TOOL CALL FORMAT:
Use this XML format for tool calls:
<xai:function_call name="TOOL_NAME">
  <parameter name="PARAM_NAME">PARAM_VALUE</parameter>
</xai:function_call>

Example for creating files:
<xai:function_call name="write_file">
  <parameter name="file_path">/path/to/file.txt</parameter>
  <parameter name="content">File content here</parameter>
</xai:function_call>

FORBIDDEN BEHAVIORS:
- DO NOT write code in your response text
- DO NOT provide plans or explanations before using tools
- DO NOT ask for permission - JUST USE THE TOOLS
- DO NOT output example code blocks

YOU MUST RESPOND WITH TOOL CALLS, NOT TEXT. USE THE XML FORMAT SHOWN ABOVE.`;

      // Chrome preference will be added after tool categorization

      enhancedSystemInstruction = enhancedSystemInstruction
        ? `${toolInstruction}\n\n${enhancedSystemInstruction}`
        : toolInstruction;
    }

    // Map Google GenAI history (including tool responses) to OpenAI messages
    const { mapGenAIContentsToOpenAIMessages, toOpenAITools } = await import(
      './tools.js'
    );
    const messages = mapGenAIContentsToOpenAIMessages(
      (request as any).contents as Content[] | Content | undefined,
      enhancedSystemInstruction,
    );

    logMessageMapping((request as any).contents, messages);

    const tools = toOpenAITools((genConfig as { tools?: unknown })?.tools);

    // Always log tool conversion for streaming since this is critical
    if (tools?.length) {
      debugLog('tool', 'Converted tools for streaming', {
        toolCount: tools.length,
        toolNames: tools.map((t: any) => t.function?.name),
      });
    }

    // Only log message sizes when there are potential issues or tools
    const processedMessages = messages.map((msg: any) => {
      if (msg.content && (tools?.length || msg.content.length > 10000)) {
        debugLog(
          'request',
          `Stream message size - ${msg.role}: ${msg.content.length} characters`,
        );
      }
      return msg;
    });

    const args: any = {
      model: this.model ?? (request as any).model,
      messages: processedMessages,
      stream: true,
      temperature: genConfig?.temperature ?? 0.7, // Use same default as grok-cli
      max_tokens: genConfig?.maxOutputTokens ?? 4000, // Full tokens with paid account
    };

    // No tool limitations - use all available tools
    const limitedTools = tools;

    if (limitedTools && limitedTools.length > 0) {
      args['tools'] = limitedTools;
      args['tool_choice'] = 'auto';
      debugLog('tool', 'Enabled tools for request', {
        toolNames: limitedTools.map((t: any) => t.function?.name),
      });
    }
    debugLog('tool', 'Tool status for streaming request', {
      toolCount: tools?.length || 0,
      status: 'Using all available tools',
    });

    // For Grok models, optionally enable real-time web search
    // Commenting out for debugging - might be causing timeout
    // if ((this.model ?? (request as any).model)?.toLowerCase().includes('grok')) {
    //   args.search_parameters = { mode: 'auto' };
    // }

    logApiRequest('chat.completions.create (stream)', args);

    return streamOpenAIChat(client as any, args);
  }

  async countTokens(req: CountTokensParameters): Promise<CountTokensResponse> {
    // Heuristic fallback estimate based on text parts only
    const contents = Array.isArray(req.contents)
      ? req.contents
      : [req.contents];
    const text = JSON.stringify(contents);
    const totalTokens = estimateTokens(text);
    return { totalTokens } as CountTokensResponse;
  }

  async embedContent(
    _req: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Not supported in initial Grok MVP; can throw or no-op
    throw new Error('Grok embeddings not implemented');
  }
}
