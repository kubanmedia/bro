/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_PRIMARY_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';

import { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { getInstallationId } from '../utils/user_id.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_GROK = 'grok-api-key',
}

export enum Provider {
  GOOGLE = 'google',
  GROK = 'grok',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  proxy?: string | undefined;
  provider?: Provider;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;
  // Grok-compatible env
  const grokApiKey =
    process.env['GROK_API_KEY'] || process.env['XAI_API_KEY'] || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_PRIMARY_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
  };

  // Auto-select Grok provider if Grok key present and no specific auth type
  if (grokApiKey && authType === undefined) {
    contentGeneratorConfig.provider = Provider.GROK;
    contentGeneratorConfig.apiKey = grokApiKey;
    return contentGeneratorConfig;
  }

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GROK && grokApiKey) {
    contentGeneratorConfig.provider = Provider.GROK;
    contentGeneratorConfig.apiKey = grokApiKey;
    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `AnusCLI/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  // Provider registry: route to GrokContentGenerator if provider is GROK
  // or if a Grok-compatible key is present (implicit provider selection).
  // When createContentGeneratorConfig detects a Grok key, it sets provider=GROK and apiKey accordingly.
  const isGrokSelected =
    config.provider === Provider.GROK || config.authType === AuthType.USE_GROK;
  if (isGrokSelected) {
    const { GrokContentGenerator } = await import(
      '../providers/grok/contentGenerator.js'
    );
    return new LoggingContentGenerator(
      new GrokContentGenerator(config.model, config.apiKey),
      gcConfig,
    );
  }

  if (config.authType === AuthType.USE_VERTEX_AI) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationId = getInstallationId();
      headers = {
        ...headers,
        'x-anus-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }
  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
