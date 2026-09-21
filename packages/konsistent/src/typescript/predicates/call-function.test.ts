import { describe, expect, it } from "vitest";
import type { PredicateContext } from "../../core/context.js";
import { parseFileStructure } from "../parser.js";
import { checkCallFunction } from "./call-function.js";

function createContext(opts: {
  placeholders?: Record<string, string>;
}): PredicateContext {
  const placeholders = opts.placeholders ?? {};
  return {
    path: "src/index.ts",
    placeholders: {} as PredicateContext["placeholders"],
    resolveTemplate(template: string): string {
      return template.replace(
        /\$\{(\w+)\}/g,
        (match, name: string) => placeholders[name] ?? match
      );
    },
    fileExists: () => false,
    readDir: () => [],
  };
}

function parseSource(opts: { source: string }) {
  return parseFileStructure({ source: opts.source, filePath: "src/index.ts" });
}

describe("checkCallFunction", () => {
  it("matches local, imported, and member calls by local call spelling", () => {
    const result = checkCallFunction({
      expected: ["initialize", "dispatch", "send"],
      context: createContext({}),
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
      expected: ["initialize"],
      context: createContext({}),
      fileStructure: parseSource({ source: "other();" }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      message: 'Missing call to function "initialize"',
      predicateName: "callFunction",
      filePath: "src/index.ts",
    });
  });

  it("matches configured argument expressions by position and allows extras", () => {
    const result = checkCallFunction({
      expected: [
        {
          name: "send",
          arguments: ["'email'", "options"],
        },
      ],
      context: createContext({}),
      fileStructure: parseSource({
        source: 'send("email", options, callback);',
      }),
    });

    expect(result).toEqual([]);
  });

  it("does not combine arguments from separate calls", () => {
    const result = checkCallFunction({
      expected: [
        {
          name: "send",
          arguments: ["'email'", "expectedOptions"],
        },
      ],
      context: createContext({}),
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
      expected: [
        {
          name: "${functionName}",
          arguments: ["'${eventName}'"],
        },
      ],
      context: createContext({
        placeholders: { eventName: "email", functionName: "send" },
      }),
      fileStructure: parseSource({ source: 'send("email");' }),
    });

    expect(result).toEqual([]);
  });
});
