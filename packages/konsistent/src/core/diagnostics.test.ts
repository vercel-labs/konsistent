import { describe, expect, it } from "vitest";
import { createDiagnostic } from "./diagnostics.js";

describe("createDiagnostic", () => {
  it("creates a diagnostic with required fields", () => {
    const d = createDiagnostic({
      filePath: "src/foo.ts",
      message: "Expected a file",
      predicateName: "haveType",
    });
    expect(d).toEqual({
      column: undefined,
      conventionName: undefined,
      filePath: "src/foo.ts",
      line: undefined,
      message: "Expected a file",
      predicateName: "haveType",
      severity: "error",
    });
  });

  it("creates a diagnostic with optional fields", () => {
    const d = createDiagnostic({
      column: 5,
      conventionName: "my-convention",
      filePath: "src/bar.ts",
      line: 10,
      message: "Expected a directory",
      predicateName: "haveType",
    });
    expect(d.severity).toBe("error");
    expect(d.conventionName).toBe("my-convention");
    expect(d.line).toBe(10);
    expect(d.column).toBe(5);
  });

  it("defaults severity to error when not specified", () => {
    const d = createDiagnostic({
      filePath: "src/foo.ts",
      message: "Missing export",
      predicateName: "exportValues",
    });
    expect(d.severity).toBe("error");
  });

  it("creates a warning diagnostic when severity is warning", () => {
    const d = createDiagnostic({
      filePath: "src/foo.ts",
      message: "Missing export",
      predicateName: "exportValues",
      severity: "warning",
    });
    expect(d.severity).toBe("warning");
  });

  it("creates an error diagnostic when severity is explicitly error", () => {
    const d = createDiagnostic({
      filePath: "src/foo.ts",
      message: "Missing export",
      predicateName: "exportValues",
      severity: "error",
    });
    expect(d.severity).toBe("error");
  });
});
