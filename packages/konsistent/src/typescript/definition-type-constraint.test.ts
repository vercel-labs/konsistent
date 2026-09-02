import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../core/context.js";
import {
  checkConstantDefinitionConstraint,
  checkTypeDefinitionConstraint,
} from "./definition-type-constraint.js";
import { parseFileStructure } from "./parser.js";

function createContext(): PredicateContext {
  return {
    path: "src/index.ts",
    placeholders: {},
    resolveTemplate: (template) =>
      template.replace("${scope}", "ModuleSettings"),
    fileExists: () => false,
    readDir: () => [],
  };
}

describe("definition type constraints", () => {
  it("matches exact constant annotations after template resolution", () => {
    const result = checkConstantDefinitionConstraint({
      context: createContext(),
      definition: { type: "Readonly<${scope}>" },
      fileStructure: parseFileStructure({
        source: "const settings: Readonly<ModuleSettings> = {};",
      }),
      name: "settings",
      predicateName: "declareConstants",
    });

    expect(result).toBeUndefined();
  });

  it("reports exact type alias expression mismatches", () => {
    const result = checkTypeDefinitionConstraint({
      context: createContext(),
      definition: { type: "ModuleSettings<'public'>" },
      fileStructure: parseFileStructure({
        source: "type Settings = ModuleSettings<'internal'>;",
      }),
      name: "Settings",
      predicateName: "declareTypes",
    });

    expect(result).toMatchObject({
      message: `Type "Settings" must have type "ModuleSettings<'public'>"`,
      predicateName: "declareTypes",
    });
  });

  it("keeps JSON schema constraints supported", () => {
    const result = checkTypeDefinitionConstraint({
      context: createContext(),
      definition: {
        schema: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
        },
      },
      fileStructure: parseFileStructure({
        source: "interface Settings { enabled?: boolean }",
      }),
      name: "Settings",
      predicateName: "declareTypes",
    });

    expect(result).toBeUndefined();
  });
});
