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
    args: shell ? opts.args.map((argument) => `"${argument}"`) : opts.args,
    command: opts.command,
    shell,
  };
}

function runCommand(opts) {
  const invocation = resolveCommandInvocation(opts);
  return execFile(invocation.command, invocation.args, {
    cwd: opts.cwd,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "",
      KONSISTENT_NO_UPDATE_CHECK: "true",
    },
    maxBuffer: 2 * 1024 * 1024,
    shell: invocation.shell,
    timeout: 120_000,
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
    await Promise.all(
      ["convention", "common-conventions", "konsistent"].map((directory) =>
        runCommand({
          args: ["pack", "--pack-destination", temporaryDirectory],
          command: "pnpm",
          cwd: join(repositoryDirectory, "packages", directory),
        })
      )
    );
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
      args: [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        ...tarballs.map((name) => join(temporaryDirectory, name)),
      ],
      command: "npm",
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

    await Promise.all(
      ["typescript-runtime", "typescript-runtime-filesystem"].map(
        async (fixture) => {
          const cwd = join(temporaryDirectory, fixture);
          await cp(join(repositoryDirectory, "e2e", "fixtures", fixture), cwd, {
            recursive: true,
          });
          const checked = await runCommand({
            args: [installedCli, "check", "--format=json"],
            command: process.execPath,
            cwd,
          });
          assert.deepEqual(JSON.parse(checked.stdout), []);
          await runCommand({
            args: [installedCli, "validate"],
            command: process.execPath,
            cwd,
          });
        }
      )
    );
    const [versionResult] = await Promise.all([
      runCommand({
        args: [installedCli, "help"],
        command: process.execPath,
        cwd: temporaryDirectory,
      }),
      runCommand({
        args: [installedCli, "--version"],
        command: process.execPath,
        cwd: temporaryDirectory,
      }),
    ]);
    assert.equal(versionResult.stdout.trim(), cliManifest.version);

    const consumerPath = join(temporaryDirectory, "consumer.ts");
    await writeFile(
      consumerPath,
      'import { defineConventions, type ReusableConventionV1 } from "@konsistent/convention";\nexport const conventions = defineConventions([{ name: "consumer", description: "Require the source directory", paths: "src", must: { haveType: "directory" } }] satisfies ReusableConventionV1[]);\n'
    );
    await runCommand({
      args: [
        installedConventionCli,
        "emit",
        "--input",
        consumerPath,
        "--output",
        "consumer-conventions.json",
      ],
      command: process.execPath,
      cwd: temporaryDirectory,
    });
    await writeFile(
      join(temporaryDirectory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "es2022",
          types: [],
        },
        files: ["consumer.ts"],
      })
    );
    await runCommand({
      args: [
        join(installedDirectory, "typescript", "bin", "tsc"),
        "-p",
        "tsconfig.json",
      ],
      command: process.execPath,
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
      await Promise.all(
        [["check", "--format=json"], ["validate"], ["help"], ["--version"]].map(
          (args) =>
            runCommand({
              args: [installedCli, ...args],
              command: process.execPath,
              cwd,
            })
        )
      );
      await assert.rejects(
        runCommand({
          args: [installedCli, "check", "--format=json"],
          command: process.execPath,
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
    await rm(temporaryDirectory, { force: true, recursive: true });
    if (!hadDocs) {
      await rm(docsDirectory, { force: true, recursive: true });
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await verifyPackage();
}
