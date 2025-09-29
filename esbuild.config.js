/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 *     ╔═══════════════════════════════════╗
 *     ║  PROMPTED, NOT PROGRAMMED - 2025  ║
 *     ╚═══════════════════════════════════╝
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outfile: 'bundle/anus.js',
    platform: 'node',
    format: 'esm',
    external: [],
    alias: {
      'is-in-ci': path.resolve(
        __dirname,
        'packages/cli/src/patches/is-in-ci.ts',
      ),
    },
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
    },
    banner: {
      js: `const require = globalThis.require || (await import('module')).createRequire(import.meta.url); globalThis.__filename = (await import('url')).fileURLToPath(import.meta.url); globalThis.__dirname = (await import('path')).dirname(globalThis.__filename);`,
    },
  })
  .catch(() => process.exit(1));
