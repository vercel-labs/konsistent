import { describe, expect, expectTypeOf, it } from "vitest";
import { defineConventions } from "./define-conventions.js";
import type { ReusableConventionV1 } from "./schemas.js";

describe("defineConventions", () => {
  it("passes input through unchanged", () => {
    const input = [
      { name: "a", description: "d", must: { haveFiles: ["README.md"] } },
    ] as const satisfies readonly ReusableConventionV1[];
    const out = defineConventions(input);
    expect(out).toBe(input);
  });

  it("preserves the literal tuple type", () => {
    const out = defineConventions([
      { name: "a", description: "d", must: { haveFiles: ["README.md"] } },
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
