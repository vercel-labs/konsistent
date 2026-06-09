import { describe, expect, it } from "vitest";
import {
  compareVersions,
  getPrereleaseChannel,
  isNewerVersion,
  type ParsedVersion,
  parseVersion,
  versionSatisfiesRange,
} from "./semver.js";

function parse(version: string): ParsedVersion {
  const result = parseVersion(version);
  if (!result) {
    throw new Error(`Failed to parse version: ${version}`);
  }
  return result;
}

describe("parseVersion", () => {
  it("parses a stable version", () => {
    expect(parseVersion("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prereleaseTag: null,
      prereleaseNum: null,
    });
  });

  it("parses an alpha prerelease", () => {
    expect(parseVersion("0.0.1-alpha.4")).toEqual({
      major: 0,
      minor: 0,
      patch: 1,
      prereleaseTag: "alpha",
      prereleaseNum: 4,
    });
  });

  it("parses a beta prerelease", () => {
    expect(parseVersion("1.0.0-beta.12")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prereleaseTag: "beta",
      prereleaseNum: 12,
    });
  });

  it("parses an rc prerelease", () => {
    expect(parseVersion("2.1.0-rc.1")).toEqual({
      major: 2,
      minor: 1,
      patch: 0,
      prereleaseTag: "rc",
      prereleaseNum: 1,
    });
  });

  it("returns null for invalid version", () => {
    expect(parseVersion("not-a-version")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("1.2.3-Alpha.1")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("compares major versions", () => {
    expect(compareVersions({ a: parse("1.0.0"), b: parse("2.0.0") })).toBe(-1);
    expect(compareVersions({ a: parse("2.0.0"), b: parse("1.0.0") })).toBe(1);
  });

  it("compares minor versions", () => {
    expect(compareVersions({ a: parse("1.1.0"), b: parse("1.2.0") })).toBe(-1);
  });

  it("compares patch versions", () => {
    expect(compareVersions({ a: parse("1.0.1"), b: parse("1.0.2") })).toBe(-1);
  });

  it("returns 0 for equal versions", () => {
    expect(compareVersions({ a: parse("1.2.3"), b: parse("1.2.3") })).toBe(0);
  });

  it("stable is greater than prerelease at same version", () => {
    expect(
      compareVersions({ a: parse("1.0.0"), b: parse("1.0.0-alpha.1") })
    ).toBe(1);
    expect(
      compareVersions({ a: parse("1.0.0-alpha.1"), b: parse("1.0.0") })
    ).toBe(-1);
  });

  it("compares prerelease tags alphabetically", () => {
    expect(
      compareVersions({ a: parse("1.0.0-alpha.1"), b: parse("1.0.0-beta.1") })
    ).toBe(-1);
    expect(
      compareVersions({ a: parse("1.0.0-beta.1"), b: parse("1.0.0-rc.1") })
    ).toBe(-1);
  });

  it("compares prerelease numbers", () => {
    expect(
      compareVersions({ a: parse("1.0.0-alpha.3"), b: parse("1.0.0-alpha.10") })
    ).toBe(-1);
  });

  it("compares equal prerelease versions", () => {
    expect(
      compareVersions({ a: parse("0.0.1-alpha.4"), b: parse("0.0.1-alpha.4") })
    ).toBe(0);
  });
});

describe("getPrereleaseChannel", () => {
  it("returns null for stable versions", () => {
    expect(getPrereleaseChannel("1.0.0")).toBeNull();
  });

  it("returns channel name for prereleases", () => {
    expect(getPrereleaseChannel("0.0.1-alpha.4")).toBe("alpha");
    expect(getPrereleaseChannel("1.0.0-beta.1")).toBe("beta");
    expect(getPrereleaseChannel("2.0.0-rc.3")).toBe("rc");
  });

  it("returns null for invalid versions", () => {
    expect(getPrereleaseChannel("invalid")).toBeNull();
  });
});

describe("isNewerVersion", () => {
  it("returns true when candidate is newer", () => {
    expect(isNewerVersion({ current: "1.0.0", candidate: "1.0.1" })).toBe(true);
    expect(
      isNewerVersion({
        current: "0.0.1-alpha.4",
        candidate: "0.0.1-alpha.5",
      })
    ).toBe(true);
  });

  it("returns false when candidate is older or equal", () => {
    expect(isNewerVersion({ current: "1.0.1", candidate: "1.0.0" })).toBe(
      false
    );
    expect(isNewerVersion({ current: "1.0.0", candidate: "1.0.0" })).toBe(
      false
    );
  });

  it("returns false for invalid versions", () => {
    expect(isNewerVersion({ current: "invalid", candidate: "1.0.0" })).toBe(
      false
    );
  });
});

describe("versionSatisfiesRange", () => {
  it("satisfies ^1.2.3 for same major", () => {
    expect(versionSatisfiesRange({ range: "^1.2.3", version: "1.2.3" })).toBe(
      true
    );
    expect(versionSatisfiesRange({ range: "^1.2.3", version: "1.9.0" })).toBe(
      true
    );
    expect(versionSatisfiesRange({ range: "^1.2.3", version: "2.0.0" })).toBe(
      false
    );
  });

  it("satisfies ^0.2.3 for same minor", () => {
    expect(versionSatisfiesRange({ range: "^0.2.3", version: "0.2.5" })).toBe(
      true
    );
    expect(versionSatisfiesRange({ range: "^0.2.3", version: "0.3.0" })).toBe(
      false
    );
  });

  it("satisfies ^0.0.3 for same patch", () => {
    expect(versionSatisfiesRange({ range: "^0.0.3", version: "0.0.3" })).toBe(
      true
    );
    expect(versionSatisfiesRange({ range: "^0.0.3", version: "0.0.4" })).toBe(
      false
    );
  });

  it("handles prerelease ranges", () => {
    expect(
      versionSatisfiesRange({
        range: "^0.0.1-alpha.4",
        version: "0.0.1-alpha.5",
      })
    ).toBe(true);
    expect(
      versionSatisfiesRange({
        range: "^0.0.1-alpha.4",
        version: "0.0.1-alpha.3",
      })
    ).toBe(false);
    expect(
      versionSatisfiesRange({
        range: "^0.0.1-alpha.4",
        version: "0.0.2-alpha.1",
      })
    ).toBe(false);
  });

  it("rejects versions below range base", () => {
    expect(versionSatisfiesRange({ range: "^1.2.3", version: "1.2.2" })).toBe(
      false
    );
  });

  it("returns false for non-caret ranges", () => {
    expect(versionSatisfiesRange({ range: "~1.2.3", version: "1.2.4" })).toBe(
      false
    );
    expect(versionSatisfiesRange({ range: "1.2.3", version: "1.2.3" })).toBe(
      false
    );
  });
});
