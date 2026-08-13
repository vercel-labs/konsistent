import { describe, expect, it } from "vitest";
import updateCommand from "./update.js";

describe("update command", () => {
  it("defines metadata and arguments", () => {
    expect(updateCommand).toMatchObject({
      meta: { name: "update" },
      args: {},
    });
  });
});
