#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..", "..");
const packagesRootDir = path.join(rootDir, "packages");
const pnpmCommand = path.join(
  path.dirname(process.execPath),
  process.platform === "win32" ? "pnpm.cmd" : "pnpm"
);
const NUMERIC_IDENTIFIER_RE = /^\d+$/;
const SEMVER_RE =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function getChildEnv() {
  const env = { ...process.env };

  for (const key of Object.keys(env)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === "npm_command" ||
      normalizedKey === "npm_config_argv" ||
      normalizedKey === "npm_config_user_agent" ||
      normalizedKey === "npm_execpath" ||
      normalizedKey === "npm_node_execpath" ||
      normalizedKey.startsWith("npm_lifecycle_") ||
      normalizedKey.startsWith("npm_package_")
    ) {
      delete env[key];
    }
  }

  return env;
}

async function runCommand({
  allowFailure = false,
  args,
  command,
  cwd,
  stdio = "pipe",
}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: getChildEnv(),
      stdio,
    });
    let stdout = "";
    let stderr = "";

    if (child.stdout !== null) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }

    if (child.stderr !== null) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (status, signal) => {
      const result = {
        status: status ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };

      if (result.status !== 0 && !allowFailure) {
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n")
          .trim();

        reject(
          new Error(formatCommandFailure({ output, args, command, signal }))
        );
        return;
      }

      resolve(result);
    });
  });
}

function formatCommandFailure({ args, command, output, signal }) {
  if (output.length > 0) {
    return output;
  }
  const invocation = `${command} ${args.join(" ")}`;
  if (signal === null) {
    return `Command failed: ${invocation}`;
  }
  return `Command failed with signal ${signal}: ${invocation}`;
}

async function readPackage({ folderName }) {
  const packageDir = path.join(packagesRootDir, folderName);
  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  return {
    folderName,
    name: packageJson.name,
    packageJsonPath,
    private: packageJson.private === true,
    version: packageJson.version,
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
          return await readPackage({
            folderName: entry.name,
          });
        } catch (error) {
          if (error?.code === "ENOENT") {
            return null;
          }

          throw error;
        }
      })
  );

  return packageEntries.filter((pkg) => pkg !== null);
}

function parseCliArgs({ argv }) {
  let dryRun = false;
  let otp;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--otp") {
      otp = argv[index + 1];
      index += 1;
      if (!otp) {
        throw new Error("Missing value for --otp.");
      }
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return {
    dryRun,
    otp,
  };
}

function parseVersion({ version }) {
  const match = version.match(SEMVER_RE);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
    version,
  };
}

function comparePrereleaseIdentifier({ left, right }) {
  const leftIsNumeric = NUMERIC_IDENTIFIER_RE.test(left);
  const rightIsNumeric = NUMERIC_IDENTIFIER_RE.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }

  if (leftIsNumeric) {
    return -1;
  }

  if (rightIsNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

function compareVersions({ left, right }) {
  const parsedLeft = parseVersion({ version: left });
  const parsedRight = parseVersion({ version: right });
  const coreComparison =
    parsedLeft.major - parsedRight.major ||
    parsedLeft.minor - parsedRight.minor ||
    parsedLeft.patch - parsedRight.patch;

  if (coreComparison !== 0) {
    return coreComparison;
  }

  if (parsedLeft.prerelease.length === 0 && parsedRight.prerelease.length > 0) {
    return 1;
  }

  if (parsedLeft.prerelease.length > 0 && parsedRight.prerelease.length === 0) {
    return -1;
  }

  const maxPrereleaseLength = Math.max(
    parsedLeft.prerelease.length,
    parsedRight.prerelease.length
  );

  for (let index = 0; index < maxPrereleaseLength; index += 1) {
    if (index >= parsedLeft.prerelease.length) {
      return -1;
    }

    if (index >= parsedRight.prerelease.length) {
      return 1;
    }

    const identifierComparison = comparePrereleaseIdentifier({
      left: parsedLeft.prerelease[index],
      right: parsedRight.prerelease[index],
    });

    if (identifierComparison !== 0) {
      return identifierComparison;
    }
  }

  return 0;
}

function getHighestVersion({ versions }) {
  if (versions.length === 0) {
    return null;
  }

  return versions
    .toSorted((left, right) => compareVersions({ left, right }))
    .at(-1);
}

function isRegistryNotFoundError({ stderr, stdout }) {
  const output = `${stdout}\n${stderr}`.toLowerCase();

  return (
    output.includes("404") ||
    output.includes("not found") ||
    output.includes("not in this registry") ||
    output.includes("not in the npm registry") ||
    output.includes("no match found")
  );
}

async function getPublishedVersions({ packageName }) {
  const result = await runCommand({
    allowFailure: true,
    args: ["view", packageName, "versions", "--json"],
    command: pnpmCommand,
    cwd: rootDir,
  });

  if (result.status !== 0) {
    if (
      isRegistryNotFoundError({
        stderr: result.stderr,
        stdout: result.stdout,
      })
    ) {
      return [];
    }

    throw new Error(
      `Failed to read published versions for ${packageName}:\n${result.stderr || result.stdout}`
    );
  }

  const versions = JSON.parse(result.stdout);

  if (typeof versions === "string") {
    return [versions];
  }

  if (!Array.isArray(versions)) {
    throw new Error(`Invalid npm versions response for ${packageName}.`);
  }

  return versions;
}

function createPlan({ highestVersion, pkg }) {
  if (!(pkg.name && pkg.version)) {
    return {
      action: "skip",
      reason: `${pkg.folderName} does not declare both name and version.`,
    };
  }

  if (pkg.private) {
    return {
      action: "skip",
      reason: `${pkg.name} is private.`,
    };
  }

  if (highestVersion === null) {
    return {
      action: "error",
      reason: `${pkg.name} has no published versions on npm.`,
    };
  }

  if (!highestVersion) {
    return {
      action: "error",
      reason: `Could not determine the highest published version for ${pkg.name}.`,
    };
  }

  if (!pkg.publishedVersions.includes(pkg.version)) {
    return {
      action: "error",
      reason: `${pkg.name}@${pkg.version} is not published on npm.`,
    };
  }

  if (compareVersions({ left: pkg.version, right: highestVersion }) !== 0) {
    return {
      action: "error",
      reason: `${pkg.name}@${pkg.version} is not the highest published version; ${highestVersion} is higher.`,
    };
  }

  return {
    action: "tag",
    packageSpec: `${pkg.name}@${pkg.version}`,
    reason: `${pkg.name}@${pkg.version} is the highest published version.`,
  };
}

async function setLatestDistTag({ dryRun, otp, packageSpec }) {
  const args = ["dist-tag", "add", packageSpec, "latest"];

  if (otp) {
    args.push("--otp", otp);
  }

  if (dryRun) {
    console.log(`Dry run: pnpm ${args.join(" ")}`);
    return;
  }

  await runCommand({
    args,
    command: pnpmCommand,
    cwd: rootDir,
    stdio: "inherit",
  });
}

async function main() {
  const { dryRun, otp } = parseCliArgs({
    argv: process.argv.slice(2),
  });
  const packages = await readPackages();

  if (packages.length === 0) {
    throw new Error("No packages found in packages/.");
  }

  if (dryRun) {
    console.log("Dry run enabled. No npm dist-tags will be changed.");
  }

  const plans = await Promise.all(
    packages.map(async (pkg) => {
      if (!(pkg.name && pkg.version) || pkg.private) {
        return createPlan({
          highestVersion: null,
          pkg,
        });
      }

      const publishedVersions = await getPublishedVersions({
        packageName: pkg.name,
      });
      return createPlan({
        highestVersion: getHighestVersion({
          versions: publishedVersions,
        }),
        pkg: {
          ...pkg,
          publishedVersions,
        },
      });
    })
  );
  const errors = plans.filter((plan) => plan.action === "error");

  for (const plan of plans) {
    console.log(plan.reason);
  }

  if (errors.length > 0) {
    throw new Error(
      "Cannot update latest dist-tags because one or more packages failed validation."
    );
  }

  for (const plan of plans) {
    if (plan.action !== "tag") {
      continue;
    }

    await setLatestDistTag({
      dryRun,
      otp,
      packageSpec: plan.packageSpec,
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
