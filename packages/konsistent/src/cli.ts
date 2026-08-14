import { defineCommand, runMain } from "citty";
import { checkAndPrompt, shouldCheckForUpdate } from "./update/notifier.js";
import { getVersion } from "./version.js";

const SUBCOMMANDS = new Set(["check", "validate", "version", "help", "update"]);

const main = defineCommand({
  meta: {
    name: "konsistent",
    version: getVersion(),
    description: "Enforce structural conventions in TypeScript codebases",
  },
  subCommands: {
    check: () => import("./commands/check.js").then((m) => m.default),
    validate: () => import("./commands/validate.js").then((m) => m.default),
    version: () => import("./commands/version.js").then((m) => m.default),
    help: () => import("./commands/help.js").then((m) => m.default),
    update: () => import("./commands/update.js").then((m) => m.default),
  },
});

const rawArgs = process.argv.slice(2);
const explicitCommand =
  rawArgs[0] && SUBCOMMANDS.has(rawArgs[0]) ? rawArgs[0] : undefined;
const hasSubCommand = explicitCommand !== undefined;
const hasHelpFlag = rawArgs.includes("--help") || rawArgs.includes("-h");
const hasVersionFlag = rawArgs.length === 1 && rawArgs[0] === "--version";

function getCommandName(): string {
  if (explicitCommand) {
    return explicitCommand;
  }
  if (hasHelpFlag) {
    return "help";
  }
  if (hasVersionFlag) {
    return "version";
  }
  return "check";
}

const commandName = getCommandName();

async function run() {
  if (shouldCheckForUpdate(commandName)) {
    const updated = await checkAndPrompt({
      currentVersion: getVersion(),
    });
    if (updated) {
      process.exit(0);
    }
  }

  if (hasVersionFlag) {
    console.log(getVersion());
  } else {
    if (!(hasSubCommand || hasHelpFlag)) {
      rawArgs.unshift("check");
    }
    runMain(main, { rawArgs });
  }
}

run();
