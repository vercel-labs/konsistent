import fs from 'node:fs';
import path from 'node:path';
import { versionSatisfiesRange } from './semver.js';

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

export function detectPackageManager(cwd: string): PackageManager {
  if (
    fs.existsSync(path.join(cwd, 'bun.lockb')) ||
    fs.existsSync(path.join(cwd, 'bun.lock'))
  ) {
    return 'bun';
  }
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  const pmField = readPackageManagerField(cwd);
  if (pmField) {
    return pmField;
  }

  return 'npm'; // Fallback.
}

function readPackageManagerField(cwd: string): PackageManager | null {
  try {
    const raw = fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    if (typeof pkg.packageManager !== 'string') {
      return null;
    }

    const name = pkg.packageManager.split('@')[0];
    if (
      name === 'pnpm' ||
      name === 'yarn' ||
      name === 'bun' ||
      name === 'npm'
    ) {
      return name;
    }
    return null;
  } catch {
    return null;
  }
}

export function getInstallCommand(opts: {
  packageManager: PackageManager;
  packageName: string;
  version: string;
}): { command: string; args: string[] } {
  const spec = `${opts.packageName}@${opts.version}`;

  // biome-ignore lint/style/useDefaultSwitchClause: PackageManager is exhaustive
  switch (opts.packageManager) {
    case 'bun':
      return { command: 'bun', args: ['add', spec] };
    case 'pnpm':
      return { command: 'pnpm', args: ['add', spec] };
    case 'yarn':
      return { command: 'yarn', args: ['add', spec] };
    case 'npm':
      return { command: 'npm', args: ['install', spec] };
  }
}

export function getGlobalInstallCommand(opts: {
  packageManager: PackageManager;
  packageName: string;
  version: string;
}): { command: string; args: string[] } {
  const spec = `${opts.packageName}@${opts.version}`;

  // biome-ignore lint/style/useDefaultSwitchClause: PackageManager is exhaustive
  switch (opts.packageManager) {
    case 'bun':
      return { command: 'bun', args: ['add', '--global', spec] };
    case 'pnpm':
      return { command: 'pnpm', args: ['add', '-g', spec] };
    case 'yarn':
      return { command: 'yarn', args: ['global', 'add', spec] };
    case 'npm':
      return { command: 'npm', args: ['install', '-g', spec] };
  }
}

export function isGlobalInstall(): boolean {
  const execPath = process.argv[1];
  if (!execPath) {
    return false;
  }

  const cwd = process.cwd();
  const localNodeModules = path.join(cwd, 'node_modules');
  return !execPath.startsWith(localNodeModules);
}

export function isPackageInDeps(opts: {
  cwd: string;
  packageName: string;
}): boolean {
  try {
    const raw = fs.readFileSync(path.join(opts.cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const deps = pkg.dependencies as Record<string, string> | undefined;
    const devDeps = pkg.devDependencies as Record<string, string> | undefined;
    return !!(deps?.[opts.packageName] || devDeps?.[opts.packageName]);
  } catch {
    return false;
  }
}

export function updatePackageJsonVersion(opts: {
  cwd: string;
  packageName: string;
  newVersion: string;
}): boolean {
  const pkgPath = path.join(opts.cwd, 'package.json');

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const deps = pkg.dependencies as Record<string, string> | undefined;
    const devDeps = pkg.devDependencies as Record<string, string> | undefined;

    let currentRange: string | undefined;
    let section: 'dependencies' | 'devDependencies' | undefined;

    if (deps?.[opts.packageName]) {
      currentRange = deps[opts.packageName];
      section = 'dependencies';
    } else if (devDeps?.[opts.packageName]) {
      currentRange = devDeps[opts.packageName];
      section = 'devDependencies';
    }

    if (!currentRange || !section) {
      return false;
    }

    if (
      versionSatisfiesRange({ range: currentRange, version: opts.newVersion })
    ) {
      return false;
    }

    const newRange = `^${opts.newVersion}`;
    const updated = raw.replace(
      new RegExp(
        `("${escapeRegex(opts.packageName)}"\\s*:\\s*)"${escapeRegex(currentRange)}"`
      ),
      `$1"${newRange}"`
    );

    if (updated === raw) {
      return false;
    }

    fs.writeFileSync(pkgPath, updated, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
