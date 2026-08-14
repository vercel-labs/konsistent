import { defineCommand } from "citty";
import { getVersion } from "../version.js";

const versionArgs = {};

export default defineCommand({
  meta: {
    name: "version",
    description: "Print the version number",
  },
  args: versionArgs,
  run() {
    console.log(getVersion());
  },
});
