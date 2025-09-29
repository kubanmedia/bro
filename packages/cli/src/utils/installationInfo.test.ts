/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getInstallationInfo, PackageManager } from './installationInfo.js';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { isGitRepository } from '@anus-dev/anus-core';

vi.mock('@anus-dev/anus-core', () => ({
  isGitRepository: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actualFs = await importOriginal<typeof fs>();
  return {
    ...actualFs,
    realpathSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

const mockedIsGitRepository = vi.mocked(isGitRepository);
const mockedRealPathSync = vi.mocked(fs.realpathSync);
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedExecSync = vi.mocked(childProcess.execSync);

describe('getInstallationInfo', () => {
  const projectRoot = '/path/to/project';
  let originalArgv: string[];

  beforeEach(() => {
    vi.resetAllMocks();
    originalArgv = [...process.argv];
    // Mock process.cwd() for isGitRepository
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should return UNKNOWN when cliPath is not available', async () => {
    process.argv[1] = '';
    const info = await getInstallationInfo(projectRoot, false);
    expect(info.packageManager).toBe(PackageManager.UNKNOWN);
  });

  it('should return UNKNOWN and log error if realpathSync fails', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.argv[1] = '/path/to/cli';
    const error = new Error('realpath failed');
    mockedRealPathSync.mockImplementation(() => {
      throw error;
    });

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.UNKNOWN);
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });

  it('should detect running from a local git clone', async () => {
    process.argv[1] = `${projectRoot}/packages/cli/dist/index.js`;
    mockedRealPathSync.mockReturnValue(
      `${projectRoot}/packages/cli/dist/index.js`,
    );
    mockedIsGitRepository.mockReturnValue(true);

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.UNKNOWN);
    expect(info.isGlobal).toBe(false);
    expect(info.updateMessage).toBe(
      'Running from a local git clone. Please update with "git pull".',
    );
  });

  it('should detect running via npx', async () => {
    const npxPath = `/Users/test/.npm/_npx/12345/bin/anus`;
    process.argv[1] = npxPath;
    mockedRealPathSync.mockReturnValue(npxPath);

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.NPX);
    expect(info.isGlobal).toBe(false);
    expect(info.updateMessage).toBe('Running via npx, update not applicable.');
  });

  it('should detect running via pnpx', async () => {
    const pnpxPath = `/Users/test/.pnpm/_pnpx/12345/bin/anus`;
    process.argv[1] = pnpxPath;
    mockedRealPathSync.mockReturnValue(pnpxPath);

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.PNPX);
    expect(info.isGlobal).toBe(false);
    expect(info.updateMessage).toBe('Running via pnpx, update not applicable.');
  });

  it('should detect running via bunx', async () => {
    const bunxPath = `/Users/test/.bun/install/cache/12345/bin/anus`;
    process.argv[1] = bunxPath;
    mockedRealPathSync.mockReturnValue(bunxPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.BUNX);
    expect(info.isGlobal).toBe(false);
    expect(info.updateMessage).toBe('Running via bunx, update not applicable.');
  });

  it('should detect Homebrew installation via execSync', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    const cliPath = '/usr/local/bin/anus';
    process.argv[1] = cliPath;
    mockedRealPathSync.mockReturnValue(cliPath);
    mockedExecSync.mockReturnValue(Buffer.from('anus')); // Simulate successful command

    const info = await getInstallationInfo(projectRoot, false);

    expect(mockedExecSync).toHaveBeenCalledWith(
      'brew list -1 | grep -q "^anus$"',
      { stdio: 'ignore' },
    );
    expect(info.packageManager).toBe(PackageManager.HOMEBREW);
    expect(info.isGlobal).toBe(true);
    expect(info.updateMessage).toContain('brew upgrade');
  });

  it('should fall through if brew command fails', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    const cliPath = '/usr/local/bin/anus';
    process.argv[1] = cliPath;
    mockedRealPathSync.mockReturnValue(cliPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);

    expect(mockedExecSync).toHaveBeenCalledWith(
      'brew list -1 | grep -q "^anus$"',
      { stdio: 'ignore' },
    );
    // Should fall back to default global npm
    expect(info.packageManager).toBe(PackageManager.NPM);
    expect(info.isGlobal).toBe(true);
  });

  it('should detect global pnpm installation', async () => {
    const pnpmPath = `/Users/test/.pnpm/global/5/node_modules/.pnpm/some-hash/node_modules/anus/dist/index.js`;
    process.argv[1] = pnpmPath;
    mockedRealPathSync.mockReturnValue(pnpmPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);
    expect(info.packageManager).toBe(PackageManager.PNPM);
    expect(info.isGlobal).toBe(true);
    expect(info.updateCommand).toBe('pnpm add -g @anus-dev/anus@latest');
    expect(info.updateMessage).toContain('Attempting to automatically update');

    const infoDisabled = await getInstallationInfo(projectRoot, true);
    expect(infoDisabled.updateMessage).toContain('Please run pnpm add');
  });

  it('should detect global yarn installation', async () => {
    const yarnPath = `/Users/test/.yarn/global/node_modules/anus/dist/index.js`;
    process.argv[1] = yarnPath;
    mockedRealPathSync.mockReturnValue(yarnPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);
    expect(info.packageManager).toBe(PackageManager.YARN);
    expect(info.isGlobal).toBe(true);
    expect(info.updateCommand).toBe('yarn global add @anus-dev/anus@latest');
    expect(info.updateMessage).toContain('Attempting to automatically update');

    const infoDisabled = await getInstallationInfo(projectRoot, true);
    expect(infoDisabled.updateMessage).toContain('Please run yarn global add');
  });

  it('should detect global bun installation', async () => {
    const bunPath = `/Users/test/.bun/bin/anus`;
    process.argv[1] = bunPath;
    mockedRealPathSync.mockReturnValue(bunPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);
    expect(info.packageManager).toBe(PackageManager.BUN);
    expect(info.isGlobal).toBe(true);
    expect(info.updateCommand).toBe('bun add -g @anus-dev/anus@latest');
    expect(info.updateMessage).toContain('Attempting to automatically update');

    const infoDisabled = await getInstallationInfo(projectRoot, true);
    expect(infoDisabled.updateMessage).toContain('Please run bun add');
  });

  it('should detect local installation and identify yarn from lockfile', async () => {
    const localPath = `${projectRoot}/node_modules/.bin/anus`;
    process.argv[1] = localPath;
    mockedRealPathSync.mockReturnValue(localPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });
    mockedExistsSync.mockImplementation(
      (p) => p === path.join(projectRoot, 'yarn.lock'),
    );

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.YARN);
    expect(info.isGlobal).toBe(false);
    expect(info.updateMessage).toContain('Locally installed');
  });

  it('should detect local installation and identify pnpm from lockfile', async () => {
    const localPath = `${projectRoot}/node_modules/.bin/anus`;
    process.argv[1] = localPath;
    mockedRealPathSync.mockReturnValue(localPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });
    mockedExistsSync.mockImplementation(
      (p) => p === path.join(projectRoot, 'pnpm-lock.yaml'),
    );

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.PNPM);
    expect(info.isGlobal).toBe(false);
  });

  it('should detect local installation and identify bun from lockfile', async () => {
    const localPath = `${projectRoot}/node_modules/.bin/anus`;
    process.argv[1] = localPath;
    mockedRealPathSync.mockReturnValue(localPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });
    mockedExistsSync.mockImplementation(
      (p) => p === path.join(projectRoot, 'bun.lockb'),
    );

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.BUN);
    expect(info.isGlobal).toBe(false);
  });

  it('should default to local npm installation if no lockfile is found', async () => {
    const localPath = `${projectRoot}/node_modules/.bin/anus`;
    process.argv[1] = localPath;
    mockedRealPathSync.mockReturnValue(localPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });
    mockedExistsSync.mockReturnValue(false); // No lockfiles

    const info = await getInstallationInfo(projectRoot, false);

    expect(info.packageManager).toBe(PackageManager.NPM);
    expect(info.isGlobal).toBe(false);
  });

  it('should default to global npm installation for unrecognized paths', async () => {
    const globalPath = `/usr/local/bin/anus`;
    process.argv[1] = globalPath;
    mockedRealPathSync.mockReturnValue(globalPath);
    mockedExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const info = await getInstallationInfo(projectRoot, false);
    expect(info.packageManager).toBe(PackageManager.NPM);
    expect(info.isGlobal).toBe(true);
    expect(info.updateCommand).toBe('npm install -g @anus-dev/anus@latest');
    expect(info.updateMessage).toContain('Attempting to automatically update');

    const infoDisabled = await getInstallationInfo(projectRoot, true);
    expect(infoDisabled.updateMessage).toContain('Please run npm install');
  });
});
