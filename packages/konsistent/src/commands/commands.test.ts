import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

import checkCommand, { resolveFormat } from "./check.js";
import helpCommand from "./help.js";
import updateCommand from "./update.js";
import validateCommand from "./validate.js";
import versionCommand from "./version.js";

const emptyConfigPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/empty-config"
);

const warningsOnlyPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/warnings-only"
);

const mixedSeverityPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/mixed-severity"
);

const deprecatedFunctionParamPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/deprecated-function-param"
);

const deprecatedPredicatesPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/deprecated-predicates"
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("command definitions", () => {
  it("defines metadata and arguments for every command", () => {
    expect(checkCommand).toMatchObject({ meta: { name: "check" }, args: {} });
    expect(helpCommand).toMatchObject({ meta: { name: "help" }, args: {} });
    expect(updateCommand).toMatchObject({ meta: { name: "update" }, args: {} });
    expect(validateCommand).toMatchObject({
      meta: { name: "validate" },
      args: {},
    });
    expect(versionCommand).toMatchObject({
      meta: { name: "version" },
      args: {},
    });
  });
});

describe("check command", () => {
  it("runs without error on valid config", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    await expect(
      runCommand(checkCommand, { rawArgs: [] })
    ).resolves.not.toThrow();
  });

  it("warns for deprecated predicates without affecting JSON output or exit status", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(deprecatedPredicatesPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await runCommand(checkCommand, {
      rawArgs: ["--format", "json", "--error-on-warnings"],
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Use "importValuesFrom" or "importTypesFrom" instead.'
      )
    );
    const output = writeSpy.mock.calls.map((call) => call[0]).join("");
    expect(() => JSON.parse(output)).not.toThrow();
  });
});

describe("check command path selection", () => {
  it("accepts repeated --paths values", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    await expect(
      runCommand(checkCommand, {
        rawArgs: ["--paths", "src/index.ts", "--paths=missing/**/*.ts"],
      })
    ).resolves.not.toThrow();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns and succeeds when --paths selects nothing", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    await runCommand(checkCommand, {
      rawArgs: ["--paths", "missing/**/*.ts"],
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No paths matched --paths")
    );
  });

  it.each([
    ["--paths", "src/index.ts", "--staged"],
    ["--paths", "src/index.ts", "--modified"],
    ["--staged", "--modified"],
  ])("rejects mutually exclusive selectors: %s", async (...rawArgs) => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await runCommand(checkCommand, { rawArgs });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("mutually exclusive")
    );
  });
});

describe("check command --error-on-warnings", () => {
  it("exits 1 when warnings exist and flag is set", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runCommand(checkCommand, { rawArgs: ["--error-on-warnings"] });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 0 when no diagnostics and flag is set", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    await runCommand(checkCommand, { rawArgs: ["--error-on-warnings"] });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe("check command --diagnostic-level", () => {
  it("skips warning conventions when set to error", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ["--diagnostic-level", "error"],
    });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).not.toContain("warning");
  });

  it("evaluates warning conventions when set to warning", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ["--diagnostic-level", "warning"],
    });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("warning");
  });

  it("still reports errors when set to error", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(mixedSeverityPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await runCommand(checkCommand, {
      rawArgs: ["--diagnostic-level", "error"],
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("error");
    expect(output).not.toContain("warning");
  });

  it("defaults to warning when not specified", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(warningsOnlyPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await runCommand(checkCommand, { rawArgs: [] });
    expect(exitSpy).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("warning");
  });
});

describe("validate command", () => {
  it("runs without error on valid config", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await runCommand(validateCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalled();
  });

  it("warns without exiting when receiveParamOfType is used", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(deprecatedFunctionParamPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await runCommand(validateCommand, { rawArgs: [] });
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Configuration is valid")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"receiveParamOfType" is deprecated')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "conventions[0].must.exportFunctions[0].receiveParamOfType"
      )
    );
  });

  it("warns without exiting for every deprecated predicate", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(deprecatedPredicatesPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());

    await runCommand(validateCommand, { rawArgs: [] });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Configuration is valid")
    );
    expect(warnSpy).toHaveBeenCalledTimes(6);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Use "importValuesFrom" or "importTypesFrom" instead.'
      )
    );
  });
});

describe("--config-package CLI guards", () => {
  it("check exits 1 when both --config-path and --config-package are passed", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    await runCommand(checkCommand, {
      rawArgs: ["--config-path", "/tmp/x.json", "--config-package", "@scope/p"],
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(message).toContain("--config-path");
    expect(message).toContain("--config-package");
  });

  it("check exits 1 when --config-package is path-form", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    await runCommand(checkCommand, {
      rawArgs: ["--config-package", "./some/local/path"],
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(message).toContain("looks like a filesystem path");
  });

  it("validate exits 1 when --config-package is path-form", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(emptyConfigPath);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    await runCommand(validateCommand, {
      rawArgs: ["--config-package", "/abs/path"],
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = errorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(message).toContain("looks like a filesystem path");
  });
});

describe("resolveFormat", () => {
  it("returns explicit format when not default", () => {
    expect(resolveFormat({ format: "json" })).toBe("json");
    expect(resolveFormat({ format: "github" })).toBe("github");
    expect(resolveFormat({ format: "markdown" })).toBe("markdown");
  });

  it("returns github when GITHUB_ACTIONS is true and format is default", () => {
    process.env.GITHUB_ACTIONS = "true";
    expect(resolveFormat({ format: "default" })).toBe("github");
    process.env.GITHUB_ACTIONS = undefined;
  });

  it("returns default when GITHUB_ACTIONS is not set", () => {
    process.env.GITHUB_ACTIONS = undefined;
    expect(resolveFormat({ format: "default" })).toBe("default");
  });
});

describe("help command", () => {
  it("prints help text to stdout", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await runCommand(helpCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("check"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("validate"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("version"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("--paths"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("--staged"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("--modified"));
  });
});

describe("version command", () => {
  it("prints the version to stdout", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await runCommand(versionCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith(pkg.version);
  });
});
