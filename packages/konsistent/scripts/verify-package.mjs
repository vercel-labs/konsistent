import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  cp,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const packageDirectory = resolve(import.meta.dirname, "..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const protocolPattern = /^(catalog:|workspace:)/;

export function validatePublishedPackages(opts) {
  const { cliManifest, conventionManifest, typescriptVersion } = opts;
  assert.equal(cliManifest.dependencies.typescript, typescriptVersion);
  assert.equal(cliManifest.bin.konsistent, "./dist/cli.js");
  assert.equal(cliManifest.engines.node, "^22.18.0 || ^24.11.0 || >=26.0.0");
  assert.equal(conventionManifest.exports["."].types, "./dist/index.d.ts");
  assert.equal(conventionManifest.exports["."].import, "./dist/index.js");
  assert.equal(
    conventionManifest.bin["konsistent-convention"],
    "./dist/cli.js"
  );
  for (const manifest of [cliManifest, conventionManifest]) {
    for (const version of Object.values({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    })) {
      assert.equal(protocolPattern.test(version), false);
    }
  }
}

export function resolveCommandInvocation(opts) {
  const shell =
    (opts.platform ?? process.platform) === "win32" &&
    (opts.command === "pnpm" || opts.command === "npm");
  return {
    command: opts.command,
    args: shell ? opts.args.map((argument) => `"${argument}"`) : opts.args,
    shell,
  };
}

function runCommand(opts) {
  const invocation = resolveCommandInvocation(opts);
  return execFile(invocation.command, invocation.args, {
    cwd: opts.cwd,
    shell: invocation.shell,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      ...process.env,
      KONSISTENT_NO_UPDATE_CHECK: "true",
      GITHUB_ACTIONS: "",
    },
  });
}

export async function verifyPackage() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "konsistent-package-")
  );
  const docsDirectory = join(packageDirectory, "docs");
  let hadDocs = false;
  try {
    await access(docsDirectory);
    hadDocs = true;
  } catch {
    hadDocs = false;
  }
  try {
    for (const directory of [
      "convention",
      "common-conventions",
      "konsistent",
    ]) {
      await runCommand({
        command: "pnpm",
        args: ["pack", "--pack-destination", temporaryDirectory],
        cwd: join(repositoryDirectory, "packages", directory),
      });
    }
    const tarballs = (await readdir(temporaryDirectory)).filter((name) =>
      name.endsWith(".tgz")
    );
    assert.equal(tarballs.length, 3);
    await writeFile(
      join(temporaryDirectory, "package.json"),
      JSON.stringify({
        name: "konsistent-package-verification",
        private: true,
        type: "module",
      })
    );
    await runCommand({
      command: "npm",
      args: [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        ...tarballs.map((name) => join(temporaryDirectory, name)),
      ],
      cwd: temporaryDirectory,
    });

    const installedDirectory = join(temporaryDirectory, "node_modules");
    const installedCli = join(
      installedDirectory,
      "konsistent",
      "dist",
      "cli.js"
    );
    const installedConventionCli = join(
      installedDirectory,
      "@konsistent",
      "convention",
      "dist",
      "cli.js"
    );
    const cliManifest = JSON.parse(
      await readFile(
        join(installedDirectory, "konsistent", "package.json"),
        "utf8"
      )
    );
    const conventionManifest = JSON.parse(
      await readFile(
        join(installedDirectory, "@konsistent", "convention", "package.json"),
        "utf8"
      )
    );
    const typescriptManifestPath = fileURLToPath(
      import.meta.resolve("typescript/package.json")
    );
    const typescriptVersion = JSON.parse(
      await readFile(typescriptManifestPath, "utf8")
    ).version;
    validatePublishedPackages({
      cliManifest,
      conventionManifest,
      typescriptVersion,
    });
    assert.equal(
      JSON.parse(
        await readFile(
          join(installedDirectory, "typescript", "package.json"),
          "utf8"
        )
      ).version,
      typescriptVersion
    );
    await access(
      join(installedDirectory, "konsistent", "docs", "reference", "cli.md")
    );
    await access(
      join(installedDirectory, "konsistent", "konsistent.schema.json")
    );
    await access(
      join(
        installedDirectory,
        "@konsistent",
        "convention",
        "dist",
        "index.d.ts"
      )
    );
    const libraryPath = join(
      installedDirectory,
      "@konsistent",
      "convention",
      "dist",
      "index.js"
    );
    assert.equal(
      (await readFile(installedCli, "utf8")).startsWith(
        "#!/usr/bin/env node\n"
      ),
      true
    );
    assert.equal(
      (await readFile(libraryPath, "utf8")).includes("#!/usr/bin/env node"),
      false
    );

    for (const fixture of [
      "typescript-runtime",
      "typescript-runtime-filesystem",
    ]) {
      const cwd = join(temporaryDirectory, fixture);
      await cp(join(repositoryDirectory, "e2e", "fixtures", fixture), cwd, {
        recursive: true,
      });
      const checked = await runCommand({
        command: process.execPath,
        args: [installedCli, "check", "--format=json"],
        cwd,
      });
      assert.deepEqual(JSON.parse(checked.stdout), []);
      await runCommand({
        command: process.execPath,
        args: [installedCli, "validate"],
        cwd,
      });
    }
    await runCommand({
      command: process.execPath,
      args: [installedCli, "help"],
      cwd: temporaryDirectory,
    });
    const versionResult = await runCommand({
      command: process.execPath,
      args: [installedCli, "--version"],
      cwd: temporaryDirectory,
    });
    assert.equal(versionResult.stdout.trim(), cliManifest.version);

    const consumerPath = join(temporaryDirectory, "consumer.ts");
    await writeFile(
      consumerPath,
      'import { defineConventions, type ReusableConventionV1 } from "@konsistent/convention";\nexport const conventions = defineConventions([{ name: "consumer", description: "Require the source directory", paths: "src", must: { haveType: "directory" } }] satisfies ReusableConventionV1[]);\n'
    );
    await runCommand({
      command: process.execPath,
      args: [
        installedConventionCli,
        "emit",
        "--input",
        consumerPath,
        "--output",
        "consumer-conventions.json",
      ],
      cwd: temporaryDirectory,
    });
    await writeFile(
      join(temporaryDirectory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          target: "es2022",
          module: "esnext",
          moduleResolution: "bundler",
          types: [],
        },
        files: ["consumer.ts"],
      })
    );
    await runCommand({
      command: process.execPath,
      args: [
        join(installedDirectory, "typescript", "bin", "tsc"),
        "-p",
        "tsconfig.json",
      ],
      cwd: temporaryDirectory,
    });
    const commonPath = join(
      installedDirectory,
      "@konsistent",
      "common-conventions",
      "dist",
      "conventions.json"
    );
    assert.equal(
      JSON.parse(await readFile(commonPath, "utf8")).conventionSpecVersion,
      "v1"
    );

    const nativeDirectory = join(
      installedDirectory,
      "@typescript",
      `typescript-${process.platform}-${process.arch}`
    );
    const disabledDirectory = `${nativeDirectory}.disabled`;
    await rename(nativeDirectory, disabledDirectory);
    try {
      const cwd = join(temporaryDirectory, "typescript-runtime-filesystem");
      for (const args of [
        ["check", "--format=json"],
        ["validate"],
        ["help"],
        ["--version"],
      ]) {
        await runCommand({
          command: process.execPath,
          args: [installedCli, ...args],
          cwd,
        });
      }
      await assert.rejects(
        runCommand({
          command: process.execPath,
          args: [installedCli, "check", "--format=json"],
          cwd: join(temporaryDirectory, "typescript-runtime"),
        }),
        (error) =>
          error.code === 1 &&
          error.stdout === "" &&
          error.stderr.includes("TypeScript 7 native runtime failed") &&
          error.stderr.includes("Ensure optional dependencies are installed")
      );
    } finally {
      await rename(disabledDirectory, nativeDirectory);
    }
    console.log(
      `Packed packages verified on Node ${process.versions.node} (${process.platform}-${process.arch}).`
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    if (!hadDocs) {
      await rm(docsDirectory, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await verifyPackage();
}
