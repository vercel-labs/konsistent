import pc from "picocolors";
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./diagnostics.js";
import {
  createDefaultReporter,
  createGithubReporter,
  createJsonReporter,
  createMarkdownReporter,
} from "./reporter.js";
import type { RunResult } from "./runner.js";

function makeResult(opts: {
  diagnostics: Diagnostic[];
  filesChecked?: number;
  elapsed?: number;
}): RunResult {
  return {
    diagnostics: opts.diagnostics,
    elapsed: opts.elapsed ?? 5,
    filesChecked: opts.filesChecked ?? 1,
  };
}

describe("createDefaultReporter", () => {
  const reporter = createDefaultReporter();

  it("returns summary for no diagnostics", () => {
    const output = reporter.format(
      makeResult({ diagnostics: [], elapsed: 5, filesChecked: 3 })
    );
    expect(output).toContain("Checked 3 files in 5ms.");
    expect(output).toContain("No violations found.");
  });

  it("formats diagnostics grouped by file", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "Expected a file but found a directory",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        message: "Another issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/bar.ts",
        message: "Expected a directory",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 10, filesChecked: 2 })
    );
    expect(output).toContain(pc.bold("src/foo.ts"));
    expect(output).toContain(pc.bold("src/bar.ts"));
    expect(output).toContain("Expected a file but found a directory");
    expect(output).toContain("Checked 2 files in 10ms. Found 3 errors.");
  });

  it("uses dash for line number when line is undefined", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test message",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`  -  ${pc.red("error")}  test message`);
  });

  it("uses line number when provided", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        line: 42,
        message: "test message",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`  42  ${pc.red("error")}  test message`);
  });

  it("shows convention name in dim when present", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "provider-packages",
        filePath: "src/foo.ts",
        message: "Missing export",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(
      `Missing export  ${pc.dim("[provider-packages]")}`
    );
  });

  it("omits convention name bracket when conventionName is absent", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "Some problem",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const diagLine = output.split("\n").find((l) => l.includes("Some problem"));
    expect(diagLine).toBeDefined();
    const esc = String.fromCharCode(27);
    const stripped = diagLine?.replace(
      new RegExp(`${esc}\\[[0-9;]*m`, "g"),
      ""
    );

    expect(stripped).not.toContain("[");
  });

  it("sorts file-level violations before line-specific ones", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        line: 10,
        message: "line 10 issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        message: "file-level issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        line: 5,
        message: "line 5 issue",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const diagLines = output.split("\n").filter((l) => l.includes("issue"));
    expect(diagLines[0]).toContain("file-level issue");
    expect(diagLines[1]).toContain("line 5 issue");
    expect(diagLines[2]).toContain("line 10 issue");
  });

  it("right-aligns line numbers to widest in group", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        line: 5,
        message: "issue at 5",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        line: 100,
        message: "issue at 100",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`    5  ${pc.red("error")}  issue at 5`);
    expect(output).toContain(`  100  ${pc.red("error")}  issue at 100`);
  });

  it("pads dash to match widest line number width", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "file-level",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        line: 999,
        message: "at line 999",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(`    -  ${pc.red("error")}  file-level`);
    expect(output).toContain(`  999  ${pc.red("error")}  at line 999`);
  });

  it("separates file groups with blank lines", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/a.ts",
        message: "problem a",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/b.ts",
        message: "problem b",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split("\n");
    const aIdx = lines.findIndex((l) => l.includes("problem a"));
    expect(lines[aIdx + 1]).toBe("");
  });

  it("renders root path as (project root)", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: ".",
        message: "Missing required file: README.md",
        predicateName: "haveFiles",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.bold("(project root)"));
    expect(output).not.toContain(`${pc.bold(".")}\n`);
  });

  it("makes file paths bold", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.bold("src/foo.ts"));
  });

  it("colors error severity in red", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.red("error"));
  });

  it("uses singular for 1 violation", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "a.ts",
        message: "err1",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 2, filesChecked: 1 })
    );
    expect(output).toContain("Checked 1 file in 2ms. Found 1 error.");
  });

  it("uses plural for multiple violations", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "a.ts",
        message: "err1",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "b.ts",
        message: "err2",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 3, filesChecked: 2 })
    );
    expect(output).toContain("Checked 2 files in 3ms. Found 2 errors.");
  });
});

describe("createDefaultReporter with colors disabled", () => {
  const reporter = createDefaultReporter({ colors: false });

  it("does not include ANSI escape codes in output", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "provider-packages",
        filePath: "src/foo.ts",
        line: 5,
        message: "Missing export",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output.includes("\x1b[")).toBe(false);
  });

  it("still contains all diagnostic content", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "my-convention",
        filePath: "src/bar.ts",
        message: "Something wrong",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("src/bar.ts");
    expect(output).toContain("error");
    expect(output).toContain("Something wrong");
    expect(output).toContain("[my-convention]");
    expect(output).toContain("Found 1 error.");
  });

  it("returns plain severity without red", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split("\n");
    const diagLine = lines.find((l) => l.includes("test"));
    expect(diagLine).toBeDefined();
    expect(diagLine).toContain("error");
    expect(diagLine).toBe("  -  error  test");
  });
});

describe("createJsonReporter", () => {
  const reporter = createJsonReporter();

  it("returns valid JSON parseable by JSON.parse", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "my-convention",
        filePath: "src/foo.ts",
        message: "Some problem",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("returns empty array for no diagnostics", () => {
    const output = reporter.format(makeResult({ diagnostics: [] }));
    expect(JSON.parse(output)).toEqual([]);
  });

  it("outputs correct fields for line-level diagnostic", () => {
    const diagnostics: Diagnostic[] = [
      {
        column: 5,
        conventionName: "provider-interface",
        filePath: "src/foo.ts",
        line: 3,
        message: "Missing interface",
        predicateName: "exportInterfaces",
        severity: "error",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed).toEqual([
      {
        conventionName: "provider-interface",
        filePath: "src/foo.ts",
        line: 3,
        message: "Missing interface",
        predicateName: "exportInterfaces",
        severity: "error",
      },
    ]);
  });

  it("omits line for file-level diagnostic", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "my-convention",
        filePath: "src/foo.ts",
        message: "Missing required file",
        predicateName: "haveFiles",
        severity: "error",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0]).not.toHaveProperty("line");
  });

  it("omits column from JSON output", () => {
    const diagnostics: Diagnostic[] = [
      {
        column: 5,
        filePath: "src/foo.ts",
        line: 10,
        message: "test",
        predicateName: "exportInterfaces",
        severity: "error",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0]).not.toHaveProperty("column");
  });

  it("includes multiple diagnostics as array elements", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/a.ts",
        message: "problem a",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/b.ts",
        line: 5,
        message: "problem b",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].message).toBe("problem a");
    expect(parsed[1].message).toBe("problem b");
    expect(parsed[1].line).toBe(5);
  });
});

describe("createGithubReporter", () => {
  const reporter = createGithubReporter();

  it("returns empty string for no diagnostics", () => {
    expect(reporter.format(makeResult({ diagnostics: [] }))).toBe("");
  });

  it("formats file-level violation without line parameter", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "provider-packages",
        filePath: "packages/openai/src/index.ts",
        message: 'Missing export "openai"',
        predicateName: "exportValues",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      '::error file=packages/openai/src/index.ts,title=provider-packages::Missing export "openai"'
    );
  });

  it("includes line parameter for line-specific violations", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "provider-interface",
        filePath: "packages/openai/src/openai-provider.ts",
        line: 3,
        message: 'Interface "OpenaiProvider" must extend "ProviderV1"',
        predicateName: "exportInterfaces",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      '::error file=packages/openai/src/openai-provider.ts,line=3,title=provider-interface::Interface "OpenaiProvider" must extend "ProviderV1"'
    );
  });

  it("omits column even when present on diagnostic", () => {
    const diagnostics: Diagnostic[] = [
      {
        column: 5,
        filePath: "src/foo.ts",
        line: 10,
        message: "test",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).not.toContain("col=");
    expect(output).not.toContain("column=");
    expect(output).toBe("::error file=src/foo.ts,line=10::test");
  });

  it("omits title when conventionName is absent", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "Some problem",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe("::error file=src/foo.ts::Some problem");
  });

  it("joins multiple diagnostics with newlines", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "conv-a",
        filePath: "src/a.ts",
        message: "problem a",
        predicateName: "haveType",
        severity: "error",
      },
      {
        conventionName: "conv-b",
        filePath: "src/b.ts",
        line: 5,
        message: "problem b",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("::error file=src/a.ts,title=conv-a::problem a");
    expect(lines[1]).toBe(
      "::error file=src/b.ts,line=5,title=conv-b::problem b"
    );
  });
});

describe("createMarkdownReporter", () => {
  const reporter = createMarkdownReporter();

  it("returns summary for no diagnostics", () => {
    const output = reporter.format(
      makeResult({ diagnostics: [], elapsed: 3, filesChecked: 5 })
    );
    expect(output).toContain("Checked 5 files in 3ms.");
    expect(output).toContain("No violations found.");
  });

  it("formats diagnostics as Markdown tables grouped by file", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "provider-packages",
        filePath: "packages/openai/src/index.ts",
        message: 'Missing export "openai"',
        predicateName: "exportValues",
        severity: "error",
      },
      {
        conventionName: "provider-packages",
        filePath: "packages/openai/src/index.ts",
        message: 'Missing export type "OpenaiProvider"',
        predicateName: "exportValues",
        severity: "error",
      },
      {
        conventionName: "provider-interface",
        filePath: "packages/openai/src/openai-provider.ts",
        message: 'Missing import type "ProviderV1"',
        predicateName: "importTypes",
        severity: "error",
      },
      {
        conventionName: "provider-interface",
        filePath: "packages/openai/src/openai-provider.ts",
        line: 3,
        message: 'Interface "OpenaiProvider" must extend "ProviderV1"',
        predicateName: "exportInterfaces",
        severity: "error",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 8, filesChecked: 2 })
    );
    expect(output).toContain("**`packages/openai/src/index.ts`**");
    expect(output).toContain("**`packages/openai/src/openai-provider.ts`**");
    expect(output).toContain("| Line | Severity | Message | Convention |");
    expect(output).toContain("|------|----------|---------|------------|");
    expect(output).toContain(
      '| - | error | Missing export "openai" | provider-packages |'
    );
    expect(output).toContain(
      '| 3 | error | Interface "OpenaiProvider" must extend "ProviderV1" | provider-interface |'
    );
    expect(output).toContain("**Checked 2 files in 8ms. Found 4 errors.**");
  });

  it("uses dash in Line column for file-level violations", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "file-level issue",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("| - | error | file-level issue |");
  });

  it("uses line number in Line column when provided", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        line: 42,
        message: "line issue",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("| 42 | error | line issue |");
  });

  it("lists file-level violations before line-specific ones", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        line: 10,
        message: "line 10 issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        message: "file-level issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        line: 5,
        message: "line 5 issue",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const rows = output
      .split("\n")
      .filter(
        (l) =>
          l.startsWith("|") && !l.startsWith("| Line") && !l.startsWith("|--")
      );
    expect(rows[0]).toContain("file-level issue");
    expect(rows[1]).toContain("line 5 issue");
    expect(rows[2]).toContain("line 10 issue");
  });

  it("shows empty convention column when conventionName is absent", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "Some problem",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("| - | error | Some problem |  |");
  });

  it("separates file groups with blank lines", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/a.ts",
        message: "problem a",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/b.ts",
        message: "problem b",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("|  |\n\n**`src/b.ts`**");
  });

  it("renders root path as (project root)", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: ".",
        message: "Missing required file: README.md",
        predicateName: "haveFiles",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("**`(project root)`**");
  });

  it("wraps file paths in bold backticks", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("**`src/foo.ts`**");
  });
});

describe("createDefaultReporter warning formatting", () => {
  const reporter = createDefaultReporter();

  it("colors warning severity in yellow", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test warning",
        predicateName: "haveType",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(pc.yellow("warning"));
  });

  it("shows warning-only summary", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test warning",
        predicateName: "haveType",
        severity: "warning",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 5, filesChecked: 1 })
    );
    expect(output).toContain("Found 1 warning.");
  });

  it("shows error-only summary when all errors", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test error",
        predicateName: "haveType",
        severity: "error",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 5, filesChecked: 1 })
    );
    expect(output).toContain("Found 1 error.");
  });

  it("shows mixed summary with errors and warnings", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test error",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/bar.ts",
        message: "test warning 1",
        predicateName: "haveType",
        severity: "warning",
      },
      {
        filePath: "src/baz.ts",
        message: "test warning 2",
        predicateName: "haveType",
        severity: "warning",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 5, filesChecked: 3 })
    );
    expect(output).toContain("Found 1 error and 2 warnings.");
  });

  it("shows no violations summary when empty", () => {
    const output = reporter.format(
      makeResult({ diagnostics: [], elapsed: 5, filesChecked: 1 })
    );
    expect(output).toContain("No violations found.");
  });
});

describe("createGithubReporter warning formatting", () => {
  const reporter = createGithubReporter();

  it("uses ::warning annotation for warning-severity diagnostics", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "should-have-readme",
        filePath: "src/foo.ts",
        message: "Missing recommended file",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      "::warning file=src/foo.ts,title=should-have-readme::Missing recommended file"
    );
  });

  it("uses ::error for error-severity and ::warning for warning-severity in same output", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "conv-a",
        filePath: "src/a.ts",
        message: "critical issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        conventionName: "conv-b",
        filePath: "src/b.ts",
        message: "minor issue",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split("\n");
    expect(lines[0]).toBe("::error file=src/a.ts,title=conv-a::critical issue");
    expect(lines[1]).toBe("::warning file=src/b.ts,title=conv-b::minor issue");
  });

  it("includes line parameter for warning-severity line-specific violations", () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "iface-convention",
        filePath: "src/foo.ts",
        line: 7,
        message: "Recommended interface missing",
        predicateName: "exportInterfaces",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toBe(
      "::warning file=src/foo.ts,line=7,title=iface-convention::Recommended interface missing"
    );
  });
});

describe("createJsonReporter warning formatting", () => {
  const reporter = createJsonReporter();

  it('outputs severity "warning" for warning-severity diagnostics', () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "should-have-readme",
        filePath: "src/foo.ts",
        message: "Missing recommended file",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0].severity).toBe("warning");
  });

  it("outputs mixed severity values correctly", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/a.ts",
        message: "critical issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/b.ts",
        message: "minor issue",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const parsed = JSON.parse(reporter.format(makeResult({ diagnostics })));
    expect(parsed[0].severity).toBe("error");
    expect(parsed[1].severity).toBe("warning");
  });
});

describe("createMarkdownReporter warning formatting", () => {
  const reporter = createMarkdownReporter();

  it('shows "warning" in severity column for warning-severity diagnostics', () => {
    const diagnostics: Diagnostic[] = [
      {
        conventionName: "should-have-readme",
        filePath: "src/foo.ts",
        message: "Missing recommended file",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain(
      "| - | warning | Missing recommended file | should-have-readme |"
    );
  });

  it("shows mixed severity values in table rows", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "critical issue",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/foo.ts",
        message: "minor issue",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    expect(output).toContain("| - | error | critical issue |");
    expect(output).toContain("| - | warning | minor issue |");
  });

  it("shows warning-only summary", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "minor issue",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 5, filesChecked: 1 })
    );
    expect(output).toContain("Found 1 warning.**");
  });

  it("shows mixed summary with errors and warnings", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/a.ts",
        message: "critical",
        predicateName: "haveType",
        severity: "error",
      },
      {
        filePath: "src/b.ts",
        message: "minor",
        predicateName: "haveFiles",
        severity: "warning",
      },
    ];
    const output = reporter.format(
      makeResult({ diagnostics, elapsed: 5, filesChecked: 2 })
    );
    expect(output).toContain("Found 1 error and 1 warning.**");
  });
});

describe("createDefaultReporter with colors disabled and warnings", () => {
  const reporter = createDefaultReporter({ colors: false });

  it("shows plain warning severity without color", () => {
    const diagnostics: Diagnostic[] = [
      {
        filePath: "src/foo.ts",
        message: "test warning",
        predicateName: "haveType",
        severity: "warning",
      },
    ];
    const output = reporter.format(makeResult({ diagnostics }));
    const lines = output.split("\n");
    const diagLine = lines.find((l) => l.includes("test warning"));
    expect(diagLine).toBe("  -  warning  test warning");
  });
});
