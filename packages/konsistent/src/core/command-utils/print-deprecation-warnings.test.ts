import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigV1Schema } from "../../config/schema.js";
import { printDeprecationWarnings } from "./print-deprecation-warnings.js";

const fixturePath = resolve(
  import.meta.dirname,
  "../../../../../e2e/fixtures/deprecated-predicates/konsistent.json"
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printDeprecationWarnings", () => {
  it("prints every collected deprecation warning", () => {
    const config = ConfigV1Schema.parse(
      JSON.parse(readFileSync(fixturePath, "utf-8"))
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    printDeprecationWarnings({ config });

    expect(warnSpy).toHaveBeenCalledTimes(6);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Use "importValues" instead.')
    );
  });
});
