import {
  ReusableConventionsPackageV1Schema,
  ReusableConventionV1Schema,
} from "@konsistent/convention";
import { describe, expect, it } from "vitest";
import { conventions } from "./conventions.js";

describe("common-conventions in-source data", () => {
  it("each convention parses against ReusableConventionV1Schema", () => {
    for (const convention of conventions) {
      const result = ReusableConventionV1Schema.safeParse(convention);
      expect(result.success).toBe(true);
    }
  });

  it("the wrapped array parses against ReusableConventionsPackageV1Schema", () => {
    const result = ReusableConventionsPackageV1Schema.safeParse({
      conventionSpecVersion: "v1",
      conventions,
    });
    expect(result.success).toBe(true);
  });

  it("ships exactly the three conventions called out in the PRD", () => {
    expect(conventions.map((c) => c.name)).toEqual([
      "package-dir-must-have-readme-file",
      "file-must-export-equivalent-component-function",
      "every-ts-file-must-have-tests",
    ]);
  });

  it("file-must-export-equivalent-component-function intentionally has no paths", () => {
    const target = conventions.find(
      (c) => c.name === "file-must-export-equivalent-component-function"
    );
    expect(target).toBeDefined();
    expect(target?.paths).toBeUndefined();
  });
});
