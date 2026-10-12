import { defineCommand } from "citty";
import { getVersion } from "../version.js";

const versionArgs = {};

export default defineCommand({
  args: versionArgs,
  meta: {
    description: "Print the version number",
    name: "version",
  },
  run() {
    console.log(getVersion());
  },
});
