/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'anus-cli';

export const EVENT_USER_PROMPT = 'anus_cli.user_prompt';
export const EVENT_TOOL_CALL = 'anus_cli.tool_call';
export const EVENT_API_REQUEST = 'anus_cli.api_request';
export const EVENT_API_ERROR = 'anus_cli.api_error';
export const EVENT_API_RESPONSE = 'anus_cli.api_response';
export const EVENT_CLI_CONFIG = 'anus_cli.config';
export const EVENT_FLASH_FALLBACK = 'anus_cli.flash_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'anus_cli.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'anus_cli.slash_command';
export const EVENT_IDE_CONNECTION = 'anus_cli.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'anus_cli.chat_compression';
export const METRIC_TOOL_CALL_COUNT = 'anus_cli.tool.call.count';
export const METRIC_TOOL_CALL_LATENCY = 'anus_cli.tool.call.latency';
export const METRIC_API_REQUEST_COUNT = 'anus_cli.api.request.count';
export const METRIC_API_REQUEST_LATENCY = 'anus_cli.api.request.latency';
export const METRIC_TOKEN_USAGE = 'anus_cli.token.usage';
export const METRIC_SESSION_COUNT = 'anus_cli.session.count';
export const METRIC_FILE_OPERATION_COUNT = 'anus_cli.file.operation.count';
