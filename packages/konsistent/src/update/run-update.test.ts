import { execSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pm from './package-manager.js';
import {
  canAutoUpdate,
  getManualInstallHint,
  runUpdate,
} from './run-update.js';

vi.mock('./package-manager.js', async () => {
  const actual = await vi.importActual<typeof pm>('./package-manager.js');
  return {
    ...actual,
    isGlobalInstall: vi.fn(),
    isMonorepo: vi.fn().mockReturnValue(false),
    isPackageInDeps: vi.fn(),
    detectPackageManager: vi.fn(),
    updatePackageJsonVersion: vi.fn(),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('canAutoUpdate', () => {
  beforeEach(() => {
    vi.mocked(pm.detectPackageManager).mockReturnValue('pnpm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns global mode when globally installed', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(true);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(false);

    expect(canAutoUpdate('/some/dir')).toEqual({
      mode: 'global',
      packageManager: 'pnpm',
    });
  });

  it('returns local mode when package is in deps', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(true);

    expect(canAutoUpdate('/some/dir')).toEqual({
      mode: 'local',
      packageManager: 'pnpm',
    });
  });

  it('returns null when neither global nor in deps', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(false);

    expect(canAutoUpdate('/some/dir')).toBeNull();
  });
});

describe('getManualInstallHint', () => {
  it('returns pnpm add command', () => {
    expect(
      getManualInstallHint({ packageManager: 'pnpm', version: '1.0.0' })
    ).toBe('pnpm add konsistent@1.0.0');
  });

  it('returns npm install command', () => {
    expect(
      getManualInstallHint({ packageManager: 'npm', version: '2.0.0' })
    ).toBe('npm install konsistent@2.0.0');
  });
});

describe('runUpdate', () => {
  beforeEach(() => {
    vi.mocked(pm.detectPackageManager).mockReturnValue('pnpm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints manual hint when canAutoUpdate returns null', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(false);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    runUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('pnpm add konsistent@2.0.0')
    );
    errorSpy.mockRestore();
  });

  it('updates package.json for local installs when range does not satisfy', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(true);
    vi.mocked(pm.updatePackageJsonVersion).mockReturnValue(true);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    runUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

    expect(pm.updatePackageJsonVersion).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updated konsistent version range')
    );
    errorSpy.mockRestore();
  });

  it('passes -w flag for pnpm in a monorepo', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(true);
    vi.mocked(pm.isMonorepo).mockReturnValue(true);
    vi.mocked(pm.updatePackageJsonVersion).mockReturnValue(false);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    runUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      'pnpm add -w konsistent@2.0.0',
      expect.objectContaining({ stdio: 'inherit' })
    );
    errorSpy.mockRestore();
  });

  it('passes -W flag for yarn in a monorepo', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(true);
    vi.mocked(pm.isMonorepo).mockReturnValue(true);
    vi.mocked(pm.detectPackageManager).mockReturnValue('yarn');
    vi.mocked(pm.updatePackageJsonVersion).mockReturnValue(false);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    runUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      'yarn add -W konsistent@2.0.0',
      expect.objectContaining({ stdio: 'inherit' })
    );
    errorSpy.mockRestore();
  });

  it('includes -w in manual hint for pnpm monorepo when update fails', () => {
    vi.mocked(pm.isGlobalInstall).mockReturnValue(false);
    vi.mocked(pm.isPackageInDeps).mockReturnValue(true);
    vi.mocked(pm.isMonorepo).mockReturnValue(true);
    vi.mocked(pm.updatePackageJsonVersion).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('install failed');
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    runUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('pnpm add -w konsistent@2.0.0')
    );
    errorSpy.mockRestore();
  });
});
