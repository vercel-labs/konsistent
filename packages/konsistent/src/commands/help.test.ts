import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import helpCommand from "./help.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("help command", () => {
  it("defines metadata and arguments", () => {
    expect(helpCommand).toMatchObject({ meta: { name: "help" }, args: {} });
  });

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
