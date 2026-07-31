import { describe, expect, it } from "vitest";
import {
  compileImportSourceConstraints,
  doesImportSourceConstraintMatch,
  importSourceConstraintValue,
} from "./import-source-selector.js";

function compile(expected: string | string[]) {
  const result = compileImportSourceConstraints({ expected });
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.constraints;
}

function expectInvalid(opts: { expected: string | string[]; message: string }) {
  const result = compileImportSourceConstraints({ expected: opts.expected });
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("Expected import source constraints to be invalid.");
  }
  expect(result.error).toContain(opts.message);
}

describe("compileImportSourceConstraints", () => {
  it("keeps non-overlapping exact and wildcard entries additive", () => {
    const constraints = compile([
      "react",
      "zod",
      "package/*",
      "@vendor/*",
      "@other/project/*",
    ]);

    expect(constraints.map((constraint) => constraint.source)).toEqual([
      "react",
      "zod",
      "package/*",
      "@vendor/*",
      "@other/project/*",
    ]);
  });

  it("compiles sibling exclusions and a nested re-inclusion", () => {
    const constraints = compile([
      "@ai-sdk/*",
      "!@ai-sdk/harness",
      "!@ai-sdk/harness/*",
      "@ai-sdk/harness/bridge",
    ]);

    expect(constraints).toHaveLength(1);
    expect(importSourceConstraintValue({ constraint: constraints[0] })).toEqual(
      [
        "@ai-sdk/*",
        "!@ai-sdk/harness",
        "!@ai-sdk/harness/*",
        "@ai-sdk/harness/bridge",
      ]
    );
  });

  it("supports nested wildcard re-inclusions and exclusions", () => {
    const constraints = compile([
      "@vendor/project/*",
      "!@vendor/project/internal/*",
      "@vendor/project/internal/public/*",
      "!@vendor/project/internal/public/private",
    ]);

    expect(constraints).toHaveLength(1);
  });

  it("validates statically nested template patterns", () => {
    const constraints = compile([
      "@${vendor}/*",
      "!@${vendor}/harness/*",
      "@${vendor}/harness/bridge",
    ]);

    expect(constraints).toHaveLength(1);
  });

  it("rejects a negated string", () => {
    expectInvalid({
      expected: "!@vendor/project",
      message: "may only be used in arrays",
    });
  });

  it("rejects unsupported wildcard positions", () => {
    expectInvalid({
      expected: ["@vendor/*/internal"],
      message: 'only use "*" as a trailing "/*"',
    });
  });

  it("rejects a wildcard without a prefix", () => {
    expectInvalid({
      expected: ["/*"],
      message: 'include a prefix before "/*"',
    });
  });

  it("rejects a negation without an active wildcard selector", () => {
    expectInvalid({
      expected: ["react", "!zod"],
      message: "must follow a wildcard selector",
    });
  });

  it("rejects an unrelated exclusion", () => {
    expectInvalid({
      expected: ["@vendor/*", "!react"],
      message: "must be strictly nested",
    });
  });

  it("rejects an overlapping exact constraint before a wildcard", () => {
    expectInvalid({
      expected: ["@ai-sdk/react", "@ai-sdk/*"],
      message: "overlaps independent constraint",
    });
  });

  it("rejects an overlapping exact constraint after a wildcard", () => {
    expectInvalid({
      expected: ["@ai-sdk/*", "@ai-sdk/react"],
      message: "does not change wildcard selector",
    });
  });

  it("rejects a positive entry that was not excluded", () => {
    expectInvalid({
      expected: ["@ai-sdk/*", "!@ai-sdk/harness", "@ai-sdk/react"],
      message: "does not change wildcard selector",
    });
  });

  it("rejects a re-inclusion equal to its exclusion", () => {
    expectInvalid({
      expected: ["@ai-sdk/*", "!@ai-sdk/harness", "@ai-sdk/harness"],
      message: "must be more specific",
    });
  });

  it("rejects a rule spanning included and excluded branches", () => {
    expectInvalid({
      expected: [
        "@ai-sdk/*",
        "!@ai-sdk/harness/internal/*",
        "!@ai-sdk/harness/*",
      ],
      message: "overlaps both included and excluded branches",
    });
  });

  it("rejects modifiers after an unrelated constraint closes a selector", () => {
    expectInvalid({
      expected: ["@ai-sdk/*", "react", "!@ai-sdk/harness"],
      message: "must follow a wildcard selector",
    });
  });
});

describe("doesImportSourceConstraintMatch", () => {
  it("matches package roots and sub-entrypoints under a vendor wildcard", () => {
    const [constraint] = compile("@vendor/*");

    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project",
        constraint,
      })
    ).toBe(true);
    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project/entrypoint",
        constraint,
      })
    ).toBe(true);
    expect(
      doesImportSourceConstraintMatch({
        source: "@other/project",
        constraint,
      })
    ).toBe(false);
  });

  it("matches unvendored and vendored entrypoints but not package roots", () => {
    const [unvendored] = compile("project/*");
    const [vendored] = compile("@vendor/project/*");

    expect(
      doesImportSourceConstraintMatch({
        source: "project/entrypoint",
        constraint: unvendored,
      })
    ).toBe(true);
    expect(
      doesImportSourceConstraintMatch({
        source: "project",
        constraint: unvendored,
      })
    ).toBe(false);
    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project/entrypoint",
        constraint: vendored,
      })
    ).toBe(true);
    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project",
        constraint: vendored,
      })
    ).toBe(false);
  });

  it("applies exclusions and nested re-inclusions", () => {
    const [constraint] = compile([
      "@ai-sdk/*",
      "!@ai-sdk/harness",
      "!@ai-sdk/harness/*",
      "@ai-sdk/harness/bridge",
    ]);

    for (const source of ["@ai-sdk/core", "@ai-sdk/core/testing"]) {
      expect(doesImportSourceConstraintMatch({ source, constraint })).toBe(
        true
      );
    }
    for (const source of [
      "@ai-sdk/harness",
      "@ai-sdk/harness/testing",
      "@ai-sdk/harness/bridge/testing",
    ]) {
      expect(doesImportSourceConstraintMatch({ source, constraint })).toBe(
        false
      );
    }
    expect(
      doesImportSourceConstraintMatch({
        source: "@ai-sdk/harness/bridge",
        constraint,
      })
    ).toBe(true);
  });

  it("applies deeper wildcard toggles in order", () => {
    const [constraint] = compile([
      "@vendor/project/*",
      "!@vendor/project/internal/*",
      "@vendor/project/internal/public/*",
      "!@vendor/project/internal/public/private",
    ]);

    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project/internal/secret",
        constraint,
      })
    ).toBe(false);
    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project/internal/public/api",
        constraint,
      })
    ).toBe(true);
    expect(
      doesImportSourceConstraintMatch({
        source: "@vendor/project/internal/public/private",
        constraint,
      })
    ).toBe(false);
  });
});
