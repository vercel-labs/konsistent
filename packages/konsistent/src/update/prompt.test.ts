import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { promptYesNo } from "./prompt.js";

describe("promptYesNo", () => {
  const originalStdin = process.stdin;

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin });
  });

  function mockStdin(input: string) {
    const stream = new Readable({
      read() {
        this.push(input);
        this.push(null);
      },
    });
    Object.defineProperty(process, "stdin", { value: stream });
  }

  it('returns true for "y"', async () => {
    mockStdin("y\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(true);
  });

  it('returns true for "yes"', async () => {
    mockStdin("yes\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(true);
  });

  it('returns true for "YES" (case-insensitive)', async () => {
    mockStdin("YES\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(true);
  });

  it('returns false for "n"', async () => {
    mockStdin("n\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(false);
  });

  it("returns false for empty input", async () => {
    mockStdin("\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(false);
  });

  it("returns false for arbitrary input", async () => {
    mockStdin("maybe\n");
    expect(await promptYesNo({ question: "Update?" })).toBe(false);
  });
});
