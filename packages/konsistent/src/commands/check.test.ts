import { resolve } from "node:path";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import checkCommand, { resolveFormat } from "./check.js";

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

const deprecatedPredicatesPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/deprecated-predicates"
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("check command", () => {
  it("defines metadata and arguments", () => {
    expect(checkCommand).toMatchObject({ meta: { name: "check" }, args: {} });
  });

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

describe("check command --config-package guards", () => {
  it("exits 1 when both --config-path and --config-package are passed", async () => {
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

  it("exits 1 when --config-package is path-form", async () => {
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
