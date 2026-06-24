import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ALLOWED_BUMPS = new Set(["patch"]);
const NEWLINE_RE = /\r?\n/;
const FRONTMATTER_RE = /^---\n([\s\S]+?)\n---/;
const QUOTE_RE = /^['"]|['"]$/g;
const CHANGESET_PATH_RE = /^\.changeset\/[a-z0-9][a-z0-9-]*\.md$/;

function splitLines(value) {
  return (value ?? "")
    .split(NEWLINE_RE)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function writeSummary(body) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  await fs.appendFile(file, `${body}\n`);
}

async function parseChangeset(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const stat = await fs.lstat(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(
      `Invalid changeset \`${relativePath}\` — symlinks are not allowed.`
    );
  }
  const content = await fs.readFile(absolutePath, "utf8");
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(
      `Invalid changeset \`${relativePath}\` — no YAML frontmatter found.`
    );
  }
  const bumps = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new Error(
        `Invalid changeset \`${relativePath}\` — malformed frontmatter line: \`${trimmed}\`.`
      );
    }
    const pkg = trimmed.slice(0, colon).trim().replace(QUOTE_RE, "");
    const bump = trimmed
      .slice(colon + 1)
      .trim()
      .replace(QUOTE_RE, "");
    if (!(pkg && bump)) {
      throw new Error(
        `Invalid changeset \`${relativePath}\` — malformed frontmatter line: \`${trimmed}\`.`
      );
    }
    bumps[pkg] = bump;
  }
  return bumps;
}

async function main() {
  const packageFiles = splitLines(process.env.PACKAGE_FILES);
  const addedChangesets = splitLines(process.env.ADDED_CHANGESETS);
  const allChangedChangesets = splitLines(process.env.ALL_CHANGED_CHANGESETS);

  const errors = [];

  if (packageFiles.length > 0 && addedChangesets.length === 0) {
    errors.push(
      [
        "This PR modifies non-test files under `packages/` but does not add a changeset.",
        "",
        "Run `pnpm changeset` and commit the generated `.changeset/*.md` file.",
        "",
        "Modified package files:",
        ...packageFiles.map((file) => `- \`${file}\``),
      ].join("\n")
    );
  }

  for (const file of allChangedChangesets) {
    if (!CHANGESET_PATH_RE.test(file)) {
      errors.push(`Invalid changeset path: \`${file}\`.`);
      continue;
    }
    try {
      const bumps = await parseChangeset(file);
      const invalid = Object.entries(bumps).filter(
        ([, bump]) => !ALLOWED_BUMPS.has(bump)
      );
      if (invalid.length > 0) {
        errors.push(
          [
            `Invalid changeset \`${file}\` — only \`patch\` bumps are allowed (this repo stays on \`0.0.1-alpha.*\`).`,
            ...invalid.map(
              ([pkg, bump]) => `- \`${pkg}\`: \`${bump}\` (use \`patch\`)`
            ),
          ].join("\n")
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    await writeSummary(
      `## Changeset verification failed\n\n${errors.join("\n\n")}`
    );
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  if (packageFiles.length === 0) {
    await writeSummary(
      "## Changeset verification passed\n\nNo non-test package files were modified — changeset not required."
    );
  } else {
    await writeSummary(
      `## Changeset verification passed\n\n${addedChangesets.length} changeset(s) added for ${packageFiles.length} modified package file(s).`
    );
  }
}

main().catch(async (error) => {
  console.error(error);
  await writeSummary(
    `## Changeset verification failed\n\n${error.message ?? error}`
  );
  process.exit(1);
});
