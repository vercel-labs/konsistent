import { execSync } from 'node:child_process';
import pc from 'picocolors';
import {
  detectPackageManager,
  getGlobalInstallCommand,
  getInstallCommand,
  isGlobalInstall,
  isMonorepo,
  isPackageInDeps,
  updatePackageJsonVersion,
} from './package-manager.js';
import type { PackageManager } from './package-manager.js';
import { PACKAGE_NAME } from './package-name.js';

export function canAutoUpdate(cwd: string): {
  mode: 'global' | 'local';
  packageManager: PackageManager;
} | null {
  if (isGlobalInstall()) {
    return {
      mode: 'global',
      packageManager: detectPackageManager(cwd),
    };
  }

  if (isPackageInDeps({ cwd, packageName: PACKAGE_NAME })) {
    return {
      mode: 'local',
      packageManager: detectPackageManager(cwd),
    };
  }

  return null;
}

export function getManualInstallHint(opts: {
  packageManager: PackageManager;
  version: string;
  workspaceRoot?: boolean;
}): string {
  const { command, args } = getInstallCommand({
    packageManager: opts.packageManager,
    packageName: PACKAGE_NAME,
    version: opts.version,
    workspaceRoot: opts.workspaceRoot,
  });
  return `${command} ${args.join(' ')}`;
}

export function runUpdate(opts: {
  currentVersion: string;
  latestVersion: string;
}): void {
  const cwd = process.cwd();
  const updateInfo = canAutoUpdate(cwd);

  const workspaceRoot = isMonorepo(cwd);

  if (!updateInfo) {
    const pm = detectPackageManager(cwd);
    const hint = getManualInstallHint({
      packageManager: pm,
      version: opts.latestVersion,
      workspaceRoot,
    });
    console.error(
      `Run the following command to update manually:\n  ${pc.bold(hint)}`
    );
    return;
  }

  if (updateInfo.mode === 'local') {
    const changed = updatePackageJsonVersion({
      cwd,
      packageName: PACKAGE_NAME,
      newVersion: opts.latestVersion,
    });
    if (changed) {
      console.error(
        `Updated ${PACKAGE_NAME} version range in package.json to ^${opts.latestVersion}`
      );
    }
  }

  const { command, args } =
    updateInfo.mode === 'global'
      ? getGlobalInstallCommand({
          packageManager: updateInfo.packageManager,
          packageName: PACKAGE_NAME,
          version: opts.latestVersion,
        })
      : getInstallCommand({
          packageManager: updateInfo.packageManager,
          packageName: PACKAGE_NAME,
          version: opts.latestVersion,
          workspaceRoot,
        });

  try {
    execSync(`${command} ${args.join(' ')}`, {
      stdio: 'inherit',
      cwd,
    });
    console.error(
      `\n${pc.green('✓')} Successfully updated ${PACKAGE_NAME} to v${opts.latestVersion}`
    );
  } catch {
    const hint = getManualInstallHint({
      packageManager: updateInfo.packageManager,
      version: opts.latestVersion,
      workspaceRoot,
    });
    console.error(
      `\n${pc.red('✗')} Failed to update. Run the following command manually:\n  ${pc.bold(hint)}`
    );
  }
}
