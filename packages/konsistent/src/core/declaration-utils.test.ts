import { describe, expect, it } from "vitest";
import { parseFileStructure } from "../typescript/parser.js";
import type { PredicateContext } from "./context.js";
import {
  createExportedDeclarationDiagnostic,
  createMissingDeclarationDiagnostic,
  findDeclarationSymbol,
  findTypeDefinition,
  isDeclarationSymbolExported,
  resolveDefinitionName,
} from "./declaration-utils.js";

function createMockContext(): PredicateContext {
  return {
    path: "src/example.ts",
    placeholders: {},
    resolveTemplate(template: string): string {
      return template.replace("${name}", "Example");
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

describe("declaration utilities", () => {
  const fileStructure = parseFileStructure({
    filePath: "src/example.ts",
    source: [
      "type LocalType = string;",
      "interface LocalInterface {}",
      "const localValue = 1;",
      "const exportedValue = 2;",
      "export { exportedValue };",
    ].join("\n"),
  });

  it("resolves definition names from strings and objects", () => {
    const context = createMockContext();

    expect(resolveDefinitionName({ entry: "${name}Type", context })).toBe(
      "ExampleType"
    );
    expect(
      resolveDefinitionName({ entry: { name: "${name}Value" }, context })
    ).toBe("ExampleValue");
  });

  it("finds declaration symbols and type definitions", () => {
    expect(
      findDeclarationSymbol({
        fileStructure,
        kinds: ["const"],
        name: "localValue",
      })
    ).toMatchObject({ name: "localValue", kind: "const" });
    expect(
      findTypeDefinition({ fileStructure, name: "LocalType" })
    ).toMatchObject({ name: "LocalType" });
    expect(
      findTypeDefinition({ fileStructure, name: "LocalInterface" })
    ).toMatchObject({ name: "LocalInterface" });
  });

  it("detects declarations exported through named export statements", () => {
    const localSymbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["const"],
      name: "localValue",
    });
    const exportedSymbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["const"],
      name: "exportedValue",
    });

    expect(localSymbol).toBeDefined();
    expect(exportedSymbol).toBeDefined();
    if (!(localSymbol && exportedSymbol)) {
      throw new Error("Expected declaration symbols to exist");
    }
    expect(
      isDeclarationSymbolExported({
        fileStructure,
        symbol: localSymbol,
      })
    ).toBe(false);
    expect(
      isDeclarationSymbolExported({
        fileStructure,
        symbol: exportedSymbol,
      })
    ).toBe(true);
  });

  it("creates declaration diagnostics with source context", () => {
    const context = createMockContext();
    const symbol = findDeclarationSymbol({
      fileStructure,
      kinds: ["const"],
      name: "exportedValue",
    });

    expect(symbol).toBeDefined();
    if (!symbol) {
      throw new Error("Expected declaration symbol to exist");
    }
    expect(
      createMissingDeclarationDiagnostic({
        checkContext: {
          context,
          conventionName: "local-constants",
          predicateName: "declareConstants",
          severity: "warning",
        },
        label: "constant",
        name: "missingValue",
      })
    ).toMatchObject({
      filePath: "src/example.ts",
      conventionName: "local-constants",
      predicateName: "declareConstants",
      severity: "warning",
      message: 'Missing local constant declaration "missingValue"',
    });
    expect(
      createExportedDeclarationDiagnostic({
        checkContext: {
          context,
          predicateName: "declareConstants",
        },
        label: "constant",
        symbol,
      })
    ).toMatchObject({
      filePath: "src/example.ts",
      predicateName: "declareConstants",
      message:
        'Local constant declaration "exportedValue" must not be exported',
      line: 4,
      column: 7,
    });
  });
});
