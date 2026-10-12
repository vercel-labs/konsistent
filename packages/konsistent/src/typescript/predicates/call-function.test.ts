import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkCallFunction } from "./call-function.js";

function createContext(opts: {
  placeholders?: Record<string, string>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    directoryExists: () => false,
    fileExists: () => false,
    path: "src/index.ts",
    placeholders: {} as PredicateContext["placeholders"],
    readDir: () => [],
    resolveTemplate(template: string): string {
      return template.replace(
        /\$\{(\w+)\}/g,
        (match, name: string) => placeholders[name] ?? match
      );
    },
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ filePath: "src/index.ts", source: opts.source });
}

describe("checkCallFunction", () => {
  it("matches local, imported, and member calls by local call spelling", () => {
    const result = checkCallFunction({
      context: createContext({}),
      expected: ["initialize", "dispatch", "send"],
      fileStructure: parseSource({
        source: [
          'import { send as dispatch } from "./api";',
          "function run() {",
          "  initialize();",
          "  dispatch();",
          "  client.send();",
          "}",
        ].join("\n"),
      }),
    });

    expect(result).toEqual([]);
  });

  it("reports a missing call", () => {
    const result = checkCallFunction({
      context: createContext({}),
      expected: ["initialize"],
      fileStructure: parseSource({ source: "other();" }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      filePath: "src/index.ts",
      message: 'Missing call to function "initialize"',
      predicateName: "callFunction",
    });
  });

  it("matches configured argument expressions by position and allows extras", () => {
    const result = checkCallFunction({
      context: createContext({}),
      expected: [
        {
          arguments: ["'email'", "options"],
          name: "send",
        },
      ],
      fileStructure: parseSource({
        source: 'send("email", options, callback);',
      }),
    });

    expect(result).toEqual([]);
  });

  it("does not combine arguments from separate calls", () => {
    const result = checkCallFunction({
      context: createContext({}),
      expected: [
        {
          arguments: ["'email'", "expectedOptions"],
          name: "send",
        },
      ],
      fileStructure: parseSource({
        source: [
          'send("wrong", expectedOptions);',
          "send('email', otherOptions);",
        ].join("\n"),
      }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.message).toBe(
      'Missing call to function "send" with configured arguments'
    );
  });

  it("resolves templates in names and arguments", () => {
    const result = checkCallFunction({
      context: createContext({
        placeholders: { eventName: "email", functionName: "send" },
      }),
      expected: [
        {
          arguments: ["'${eventName}'"],
          name: "${functionName}",
        },
      ],
      fileStructure: parseSource({ source: 'send("email");' }),
    });

    expect(result).toEqual([]);
  });
});
