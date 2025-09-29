/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { type PartListUnion } from '@google/genai';
import { partToString } from '../utils/partUtils.js';

/**
 * Represents a request to be sent to the ANUS/Grok API.
 * For now, it's an alias to PartListUnion as the primary content.
 * This can be expanded later to include other request parameters.
 */
export type AnusCodeRequest = PartListUnion;

export function partListUnionToString(value: PartListUnion): string {
  return partToString(value, { verbose: true });
}
