/// <reference types="node" />
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "konsistent-convention",
    description:
      "Authoring CLI for reusable-convention packages consumed by konsistent.",
  },
  subCommands: {
    emit: () => import("./commands/emit.js").then((module) => module.default),
  },
});

runMain(main);
