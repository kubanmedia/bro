/* global console, process */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveGrokApiKey } from './packages/core/src/providers/grok/client.js';
console.log('GROK_API_KEY from env:', process.env['GROK_API_KEY']);
console.log('Resolved key:', resolveGrokApiKey());
