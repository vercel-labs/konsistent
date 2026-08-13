import { createRequire } from "node:module";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";
import versionCommand from "./version.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("version command", () => {
  it("defines metadata and arguments", () => {
    expect(versionCommand).toMatchObject({
      meta: { name: "version" },
      args: {},
    });
  });

  it("prints the version to stdout", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await runCommand(versionCommand, { rawArgs: [] });
    expect(logSpy).toHaveBeenCalledWith(pkg.version);
  });
});
