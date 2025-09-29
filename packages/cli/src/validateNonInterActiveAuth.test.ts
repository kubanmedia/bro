/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateNonInteractiveAuth } from './validateNonInterActiveAuth.js';
import type { Config } from '@anus-dev/anus-core';
import { AuthType } from '@anus-dev/anus-core';

type NonInteractiveConfig = Config & {
  refreshAuth: (authType: AuthType) => Promise<void>;
};

describe('validateNonInteractiveAuth', () => {
  let refreshAuthMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear all environment variables that might affect tests
    delete process.env['GROK_API_KEY'];

    refreshAuthMock = vi.fn().mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${code}) called`);
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with error when no GROK_API_KEY is set', async () => {
    const nonInteractiveConfig: NonInteractiveConfig = {
      refreshAuth: refreshAuthMock,
    } as NonInteractiveConfig;

    await expect(
      validateNonInteractiveAuth(undefined, undefined, nonInteractiveConfig),
    ).rejects.toThrow('process.exit(1) called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Please set your GROK_API_KEY environment variable (OpenRouter API key). Get your API key from https://openrouter.ai/keys',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('uses USE_GROK when GROK_API_KEY is set', async () => {
    process.env['GROK_API_KEY'] = 'fake-grok-key';
    const nonInteractiveConfig: NonInteractiveConfig = {
      refreshAuth: refreshAuthMock,
    } as NonInteractiveConfig;

    const result = await validateNonInteractiveAuth(
      undefined,
      undefined,
      nonInteractiveConfig,
    );

    expect(refreshAuthMock).toHaveBeenCalledWith(AuthType.USE_GROK);
    expect(result).toBe(nonInteractiveConfig);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('uses USE_GROK when configuredAuthType is USE_GROK', async () => {
    const nonInteractiveConfig: NonInteractiveConfig = {
      refreshAuth: refreshAuthMock,
    } as NonInteractiveConfig;

    const result = await validateNonInteractiveAuth(
      AuthType.USE_GROK,
      undefined,
      nonInteractiveConfig,
    );

    expect(refreshAuthMock).toHaveBeenCalledWith(AuthType.USE_GROK);
    expect(result).toBe(nonInteractiveConfig);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('prefers GROK_API_KEY over configuredAuthType', async () => {
    process.env['GROK_API_KEY'] = 'fake-grok-key';
    const nonInteractiveConfig: NonInteractiveConfig = {
      refreshAuth: refreshAuthMock,
    } as NonInteractiveConfig;

    const result = await validateNonInteractiveAuth(
      AuthType.USE_GROK, // This would work anyway, but testing priority
      undefined,
      nonInteractiveConfig,
    );

    expect(refreshAuthMock).toHaveBeenCalledWith(AuthType.USE_GROK);
    expect(result).toBe(nonInteractiveConfig);
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('exits when configuredAuthType is not USE_GROK and no GROK_API_KEY', async () => {
    const nonInteractiveConfig: NonInteractiveConfig = {
      refreshAuth: refreshAuthMock,
    } as NonInteractiveConfig;

    await expect(
      validateNonInteractiveAuth(
        AuthType.USE_ANUS,
        undefined,
        nonInteractiveConfig,
      ),
    ).rejects.toThrow('process.exit(1) called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Please set your GROK_API_KEY environment variable (OpenRouter API key). Get your API key from https://openrouter.ai/keys',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
