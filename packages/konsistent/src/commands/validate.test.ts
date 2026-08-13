import { resolve } from "node:path";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import validateCommand from "./validate.js";

const emptyConfigPath = resolve(
  import.meta.dirname,
  "../../../../e2e/fixtures/empty-config"
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

describe("validate command", () => {
  it("defines metadata and arguments", () => {
    expect(validateCommand).toMatchObject({
      meta: { name: "validate" },
      args: {},
    });
  });

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

  it("exits 1 when --config-package is path-form", async () => {
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
