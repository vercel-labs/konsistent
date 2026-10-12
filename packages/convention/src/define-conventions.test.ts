import { describe, expect, expectTypeOf, it } from "vitest";
import { defineConventions } from "./define-conventions.js";
import type { ReusableConventionV1 } from "./schemas.js";

describe("defineConventions", () => {
  it("passes input through unchanged", () => {
    const input = [
      { description: "d", must: { haveFiles: ["README.md"] }, name: "a" },
    ] as const satisfies readonly ReusableConventionV1[];
    const out = defineConventions(input);
    expect(out).toBe(input);
  });

  it("preserves the literal tuple type", () => {
    const out = defineConventions([
      { description: "d", must: { haveFiles: ["README.md"] }, name: "a" },
    ]);
    expectTypeOf(out).toEqualTypeOf<
      readonly [
        {
          readonly name: "a";
          readonly description: "d";
          readonly must: { readonly haveFiles: readonly ["README.md"] };
        },
      ]
    >();
  });
});
