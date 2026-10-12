/// <reference types="node" />
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    description:
      "Authoring CLI for reusable-convention packages consumed by konsistent.",
    name: "konsistent-convention",
  },
  subCommands: {
    emit: () => import("./commands/emit.js").then((module) => module.default),
  },
});

runMain(main);
