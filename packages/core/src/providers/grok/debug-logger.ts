/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Debug logger for Grok provider tool calling
 * Enable with GROK_DEBUG=true environment variable
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEBUG_ENABLED =
  process.env['GROK_DEBUG'] === 'true' || process.env['GROK_DEBUG'] === '1';
// GROK_DEBUG_LEVEL: 'minimal' (errors + tool calls only), 'standard' (default), 'verbose' (all)
const DEBUG_LEVEL = process.env['GROK_DEBUG_LEVEL'] || 'standard';
const LOG_DIR = join(homedir(), '.anus', 'logs');
const LOG_FILE = join(
  LOG_DIR,
  `grok-debug-${new Date().toISOString().split('T')[0]}.log`,
);

// Ensure log directory exists
if (DEBUG_ENABLED && !existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function shouldLog(category: string): boolean {
  if (!DEBUG_ENABLED) return false;

  // Always log critical categories regardless of level
  if (['error', 'tool'].includes(category)) return true;

  // For minimal level, only log errors and tool calls
  if (DEBUG_LEVEL === 'minimal') return false;

  // For verbose level, log everything
  if (DEBUG_LEVEL === 'verbose') return true;

  // For standard level, skip noisy categories
  const noisyCategories = ['stream', 'mapping'];
  return !noisyCategories.includes(category);
}

export function debugLog(category: string, message: string, data?: any) {
  if (!shouldLog(category)) return;

  const timestamp = new Date().toISOString();

  // Truncate large data objects for readability unless in verbose mode
  let logData = data;
  if (data && DEBUG_LEVEL !== 'verbose') {
    // Stringify and truncate if too long
    const dataStr = JSON.stringify(data, null, 2);
    if (dataStr.length > 1000) {
      logData = { ...data, _truncated: `${dataStr.length} chars truncated` };
      // Keep only essential fields for tool-related logs
      if (category === 'tool' && data.args) {
        logData = {
          args: data.args,
          _truncated: `${dataStr.length} chars total`,
        };
      }
    }
  }

  const logLine = `[${timestamp}] [${category}] ${message}${logData ? '\n' + JSON.stringify(logData, null, 2) : ''}\n`;

  // In interactive mode, only log to file to avoid interfering with the UI
  // Console logging can be enabled with GROK_DEBUG_CONSOLE=true
  const CONSOLE_DEBUG =
    process.env['GROK_DEBUG_CONSOLE'] === 'true' ||
    process.env['GROK_DEBUG_CONSOLE'] === '1';

  if (CONSOLE_DEBUG) {
    // Log to console with color coding
    const colors = {
      request: '\x1b[36m', // Cyan
      response: '\x1b[32m', // Green
      error: '\x1b[31m', // Red
      tool: '\x1b[35m', // Magenta
      stream: '\x1b[33m', // Yellow
      mapping: '\x1b[34m', // Blue
      reset: '\x1b[0m',
    };

    const color = colors[category as keyof typeof colors] || colors.reset;
    console.error(`${color}[GROK-DEBUG]${colors.reset} ${logLine}`);
  }

  // Always write to file
  try {
    appendFileSync(LOG_FILE, logLine);
  } catch (err) {
    if (CONSOLE_DEBUG) {
      console.error('Failed to write to log file:', err);
    }
  }
}

export function logToolCall(toolName: string, args: any, result?: any) {
  debugLog('tool', `Tool call: ${toolName}`, { args, result });
}

export function logApiRequest(endpoint: string, payload: any) {
  debugLog('request', `API Request to ${endpoint}`, payload);
}

export function logApiResponse(endpoint: string, response: any) {
  debugLog('response', `API Response from ${endpoint}`, response);
}

export function logStreamChunk(chunk: any) {
  debugLog('stream', 'Stream chunk received', chunk);
}

export function logMessageMapping(original: any, mapped: any) {
  debugLog('mapping', 'Message mapping', { original, mapped });
}

export function logError(context: string, error: any) {
  debugLog('error', `Error in ${context}`, {
    message: error?.message,
    stack: error?.stack,
    details: error,
  });
}

// Log initialization
if (DEBUG_ENABLED) {
  debugLog(
    'init',
    `Grok debug logging enabled (level: ${DEBUG_LEVEL}). Logs will be written to: ${LOG_FILE}`,
  );
}
