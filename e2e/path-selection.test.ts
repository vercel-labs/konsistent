import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const cliBinary = resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/index.js"
);
const fixturePath = resolve(import.meta.dirname, "fixtures/path-selection");
const temporaryDirectories = new Set<string>();

function runCli(opts: { cwd: string; args: string[] }) {
  return execFile("node", [cliBinary, ...opts.args], {
    cwd: opts.cwd,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "",
      KONSISTENT_NO_UPDATE_CHECK: "true",
    },
  });
}

function runGit(opts: { cwd: string; args: string[] }) {
  return execFile("git", opts.args, { cwd: opts.cwd });
}

async function createFixtureCopy(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "konsistent-path-selection-"));
  temporaryDirectories.add(cwd);
  await cp(fixturePath, cwd, { recursive: true });
  return cwd;
}

async function createGitFixture(opts: { commit: boolean }): Promise<string> {
  const cwd = await createFixtureCopy();
  await runGit({ cwd, args: ["init", "--quiet"] });
  await runGit({ cwd, args: ["config", "user.email", "test@example.com"] });
  await runGit({ cwd, args: ["config", "user.name", "Konsistent Tests"] });
  await runGit({ cwd, args: ["config", "commit.gpgSign", "false"] });
  if (opts.commit) {
    await runGit({ cwd, args: ["add", "."] });
    await runGit({
      cwd,
      args: ["commit", "--quiet", "-m", "Initial fixture"],
    });
  }
  return cwd;
}

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((path) =>
      rm(path, { recursive: true, force: true })
    )
  );
  temporaryDirectories.clear();
});

describe("--paths", () => {
  it("restricts directory conventions to selected file descendants", async () => {
    const result = await runCli({
      cwd: fixturePath,
      args: ["--paths", "components/Button/Button.tsx"],
    });

    expect(result.stdout).toContain("No violations found");
    expect(result.stdout).not.toContain("Button.test.tsx");
  });

  it("accepts repeated concrete paths and glob patterns", async () => {
    await expect(
      runCli({
        cwd: fixturePath,
        args: [
          "check",
          "--paths",
          "components/Button/Button.tsx",
          "--paths=components/Input/*.test.tsx",
        ],
      })
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("components/Input/Input.test.tsx"),
    });
  });

  it("warns without failing when no paths match", async () => {
    const result = await runCli({
      cwd: fixturePath,
      args: ["check", "--paths", "missing/**/*.ts"],
    });

    expect(result.stderr).toContain("No paths matched --paths");
    expect(result.stdout).toContain("Checked 0 files");
  });

  it("keeps empty-selection warnings out of JSON stdout", async () => {
    const result = await runCli({
      cwd: fixturePath,
      args: [
        "check",
        "--paths",
        "missing/**/*.ts",
        "--format",
        "json",
        "--error-on-warnings",
      ],
    });

    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(result.stderr).toContain("No paths matched --paths");
  });
});

describe("Git path selection", () => {
  it.each([
    ["--staged", "No staged files found"],
    ["--modified", "No modified files found"],
  ])("warns without failing when %s selects nothing", async (flag, warning) => {
    const cwd = await createGitFixture({ commit: true });
    const result = await runCli({ cwd, args: ["check", flag] });

    expect(result.stderr).toContain(warning);
    expect(result.stdout).toContain("Checked 0 files");
  });

  it("reports a Git error outside a repository", async () => {
    const cwd = await createFixtureCopy();

    await expect(
      runCli({ cwd, args: ["check", "--staged"] })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("not a git repository"),
    });
  });

  it("supports staged and modified selection before the first commit", async () => {
    const cwd = await createGitFixture({ commit: false });

    await expect(
      runCli({ cwd, args: ["check", "--modified"] })
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("components/Button/Button.test.tsx"),
    });

    await runGit({ cwd, args: ["add", "components/Button/Button.test.tsx"] });
    await expect(
      runCli({ cwd, args: ["check", "--staged"] })
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("components/Button/Button.test.tsx"),
    });
  });

  it("normalizes Git paths relative to a subdirectory invocation", async () => {
    const cwd = await createGitFixture({ commit: true });
    const componentsCwd = join(cwd, "components");
    await writeFile(
      join(componentsCwd, "Input/Input.test.tsx"),
      "export const changedInputTest = true;\n"
    );

    await expect(
      runCli({ cwd: componentsCwd, args: ["check", "--modified"] })
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("Input/Input.test.tsx"),
    });
  });

  it("separates staged files from all modified files and reads disk content", async () => {
    const cwd = await createGitFixture({ commit: true });
    const buttonTest = join(cwd, "components/Button/Button.test.tsx");
    const inputTest = join(cwd, "components/Input/Input.test.tsx");
    await writeFile(buttonTest, "export const describe = true;\n");
    await runGit({ cwd, args: ["add", "components/Button/Button.test.tsx"] });
    await writeFile(buttonTest, "export const test = false;\n");
    await writeFile(inputTest, "export const inputTest = true;\n");

    await mkdir(join(cwd, "components/Card"), { recursive: true });
    await writeFile(
      join(cwd, "components/Card/Card.tsx"),
      'export function Card() { return "Card"; }\n'
    );
    await writeFile(
      join(cwd, "components/Card/Card.test.tsx"),
      "export const cardTest = true;\n"
    );
    await writeFile(join(cwd, ".gitignore"), "components/Ignored/\n");
    await mkdir(join(cwd, "components/Ignored"), { recursive: true });
    await writeFile(
      join(cwd, "components/Ignored/Ignored.tsx"),
      'export function Ignored() { return "Ignored"; }\n'
    );
    await writeFile(
      join(cwd, "components/Ignored/Ignored.test.tsx"),
      "export const ignoredTest = true;\n"
    );

    await expect(
      runCli({ cwd, args: ["check", "--staged"] })
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("components/Button/Button.test.tsx"),
    });

    try {
      await runCli({ cwd, args: ["check", "--modified"] });
      expect.fail("Expected modified files to report violations");
    } catch (error: unknown) {
      const result = error as { stdout: string };
      expect(result.stdout).toContain("components/Button/Button.test.tsx");
      expect(result.stdout).toContain("components/Input/Input.test.tsx");
      expect(result.stdout).toContain("components/Card/Card.test.tsx");
      expect(result.stdout).not.toContain("components/Ignored");
    }
  });
});
