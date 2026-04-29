import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getVersion } from "./version.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("getVersion", () => {
  it("returns the version string from package.json", () => {
    const version = getVersion();
    expect(version).toBe(pkg.version);
  });

  it("returns a string", () => {
    expect(typeof getVersion()).toBe("string");
  });
});
