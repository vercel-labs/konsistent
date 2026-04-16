#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const packagesRootDir = path.join(rootDir, 'packages');

async function runCommand({
  command,
  args,
  cwd,
  allowFailure = false,
  stdio = 'pipe',
}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
    });
    let stdout = '';
    let stderr = '';

    if (child.stdout !== null) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }

    if (child.stderr !== null) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (status, signal) => {
      const result = {
        status: status ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };

      if (result.status !== 0 && !allowFailure) {
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n')
          .trim();

        let errorMessage = output;
        if (errorMessage.length === 0) {
          errorMessage =
            signal === null
              ? `Command failed: ${command} ${args.join(' ')}`
              : `Command failed with signal ${signal}: ${command} ${args.join(' ')}`;
        }

        reject(new Error(errorMessage));
        return;
      }

      resolve(result);
    });
  });
}

async function readPackage({ folderName }) {
  const packageDir = path.join(packagesRootDir, folderName);
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  return {
    folderName,
    packageDir,
    packageJsonPath,
    name: packageJson.name,
    version: packageJson.version,
    dependencies: packageJson.dependencies ?? {},
    optionalDependencies: packageJson.optionalDependencies ?? {},
  };
}

async function readPackages() {
  const entries = await readdir(packagesRootDir, {
    withFileTypes: true,
  });
  const packageEntries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        try {
          return [
            entry.name,
            await readPackage({
              folderName: entry.name,
            }),
          ];
        } catch (error) {
          if (error?.code === 'ENOENT') {
            return null;
          }

          throw error;
        }
      })
  );

  return Object.fromEntries(
    packageEntries.filter((packageEntry) => packageEntry !== null)
  );
}

function isRegistryNotFoundError({ stderr, stdout }) {
  const output = `${stdout}\n${stderr}`.toLowerCase();

  return (
    output.includes('404') ||
    output.includes('not found') ||
    output.includes('not in this registry') ||
    output.includes('not in the npm registry') ||
    output.includes('no match found')
  );
}

async function getLatestPublishedVersion({ packageName }) {
  const result = await runCommand({
    command: 'pnpm',
    args: ['view', packageName, 'time', '--json'],
    cwd: rootDir,
    allowFailure: true,
  });

  if (result.status !== 0) {
    if (
      isRegistryNotFoundError({
        stderr: result.stderr,
        stdout: result.stdout,
      })
    ) {
      return null;
    }

    throw new Error(
      `Failed to read published versions for ${packageName}:\n${result.stderr || result.stdout}`
    );
  }

  const timeMetadata = JSON.parse(result.stdout);
  const publishedVersions = Object.entries(timeMetadata)
    .filter(([version, publishedAt]) => {
      if (version === 'created' || version === 'modified') {
        return false;
      }

      return Number.isFinite(Date.parse(String(publishedAt)));
    })
    .sort((left, right) => {
      return Date.parse(String(left[1])) - Date.parse(String(right[1]));
    });

  return publishedVersions.at(-1)?.[0] ?? null;
}

function getPrereleaseTag({ version }) {
  const prerelease = version.split('-')[1];

  if (!prerelease) {
    return null;
  }

  return prerelease.split('.')[0] ?? null;
}

function parseCliArgs({ argv }) {
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--') {
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return {
    dryRun,
  };
}

async function ensureNpmLogin() {
  const result = await runCommand({
    command: 'pnpm',
    args: ['whoami'],
    cwd: rootDir,
    allowFailure: true,
  });

  if (result.status !== 0 || result.stdout.length === 0) {
    throw new Error('Not logged in to npm. Run `pnpm login` and retry.');
  }

  console.log(`npm user: ${result.stdout}`);
}

function getPublishTag({ packages }) {
  const prereleaseTags = Array.from(
    new Set(
      packages.map((pkg) =>
        getPrereleaseTag({
          version: pkg.version,
        })
      )
    )
  );

  if (prereleaseTags.length === 1) {
    return prereleaseTags[0];
  }

  throw new Error(
    'Selected packages use different prerelease tags. Align their versions before publishing.'
  );
}

async function publishPackages({ packages, dryRun }) {
  const publishTag = getPublishTag({
    packages,
  });
  const commandArgs = ['-r'];

  for (const pkg of packages) {
    commandArgs.push('--filter', pkg.name);
  }

  commandArgs.push('publish');

  if (publishTag !== null) {
    commandArgs.push('--tag', publishTag);
  }

  if (dryRun) {
    commandArgs.push('--dry-run');
  }

  console.log(
    `${dryRun ? 'Dry-running' : 'Publishing'} ${packages.length} package(s): ${packages
      .map((pkg) => `${pkg.name}@${pkg.version}`)
      .join(', ')}`
  );

  await runCommand({
    command: 'pnpm',
    args: commandArgs,
    cwd: rootDir,
    stdio: 'inherit',
  });
}

async function main() {
  const { dryRun } = parseCliArgs({
    argv: process.argv.slice(2),
  });
  const packagesByFolder = await readPackages();
  const packages = Object.values(packagesByFolder);

  if (packages.length === 0) {
    throw new Error('No publishable packages found in packages/.');
  }

  if (dryRun) {
    console.log(
      'Dry run enabled. The final publish call will use `pnpm publish --dry-run`.'
    );
  }

  await ensureNpmLogin();

  const packagesWithLatestPublishedVersion = await Promise.all(
    packages.map(async (pkg) => {
      return {
        pkg,
        latestPublishedVersion: await getLatestPublishedVersion({
          packageName: pkg.name,
        }),
      };
    })
  );
  const packagesToPublish: Record<string, unknown>[] = [];

  for (const {
    pkg,
    latestPublishedVersion,
  } of packagesWithLatestPublishedVersion) {
    if (latestPublishedVersion === pkg.version) {
      console.log(
        `Skipping ${pkg.name}@${pkg.version} (already latest published version)`
      );
      continue;
    }

    if (latestPublishedVersion === null) {
      console.log(`No published version found for ${pkg.name}`);
    } else {
      console.log(
        `${pkg.name}: latest published ${latestPublishedVersion}, local ${pkg.version}`
      );
    }

    packagesToPublish.push(pkg);
  }

  if (packagesToPublish.length === 0) {
    console.log('No packages needed publishing.');
    return;
  }

  await publishPackages({
    packages: packagesToPublish,
    dryRun,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
