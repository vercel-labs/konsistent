import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCb);
const cliBinary = resolve(
  import.meta.dirname,
  "../packages/konsistent/dist/cli.js"
);
const cwd = resolve(import.meta.dirname, "fixtures/condition-sets");

function runCli(opts: { args: string[] }) {
  return execFile("node", [cliBinary, ...opts.args], {
    cwd,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "",
      KONSISTENT_NO_UPDATE_CHECK: "true",
    },
  });
}

describe("condition-sets fixture", () => {
  it("validates condition sets, reusable inheritance, and overrides", async () => {
    const { stdout } = await runCli({ args: ["validate"] });
    expect(stdout).toContain("Configuration is valid");
  });

  it("passes combined filesystem, placeholder, and per-file import conditions", async () => {
    const { stdout } = await runCli({ args: ["check", "--format", "json"] });
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it("reports precisely the active gates and defaults replaced reusable sets to AND", async () => {
    await expect(
      runCli({ args: ["validate", "--config-path", "violations.json"] })
    ).resolves.not.toThrow();
    try {
      await runCli({
        args: ["check", "--config-path", "violations.json", "--format", "json"],
      });
      expect.fail("Expected check to exit with code 1");
    } catch (err: unknown) {
      const error = err as { code: number; stdout: string };
      expect(error.code).toBe(1);
      const diagnostics = JSON.parse(error.stdout) as {
        conventionName: string;
        filePath: string;
        predicateName: string;
      }[];
      expect(
        diagnostics.map(({ conventionName, filePath }) => ({
          conventionName,
          filePath,
        }))
      ).toEqual(
        expect.arrayContaining([
          { conventionName: "if-and", filePath: "src/both.ts" },
          { conventionName: "if-or", filePath: "src/both.ts" },
          { conventionName: "if-or", filePath: "src/partial.ts" },
          { conventionName: "if-not-and", filePath: "src/neither.ts" },
          { conventionName: "if-not-or", filePath: "src/partial.ts" },
          { conventionName: "if-not-or", filePath: "src/neither.ts" },
          { conventionName: "override-set", filePath: "src/both.ts" },
        ])
      );
      expect(diagnostics).toHaveLength(7);
      expect(
        diagnostics.every(
          ({ predicateName }) => predicateName === "exportConstants"
        )
      ).toBe(true);
    }
  });

  it.each(["invalid-empty.json", "invalid-nested.json"])(
    "rejects %s",
    async (configPath) => {
      await expect(
        runCli({ args: ["validate", "--config-path", configPath] })
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("Invalid config"),
      });
    }
  );

  it("validates placeholders even in condition entries runtime evaluation could skip", async () => {
    await expect(
      runCli({
        args: ["validate", "--config-path", "undeclared-placeholder.json"],
      })
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        "must.if.conditions[1].hasValueImportFrom"
      ),
    });
  });
});
