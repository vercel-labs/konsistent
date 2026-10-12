import { defineCommand } from "citty";
import pc from "picocolors";
import { PACKAGE_NAME } from "../update/package-name.js";
import { fetchLatestVersion } from "../update/registry.js";
import { runUpdate } from "../update/run-update.js";
import { isNewerVersion } from "../update/semver.js";
import { getVersion } from "../version.js";

const updateArgs = {};

export default defineCommand({
  args: updateArgs,
  meta: {
    description: "Update konsistent to the latest version",
    name: "update",
  },
  async run() {
    const currentVersion = getVersion();

    console.error("Checking for updates...");

    const latestVersion = await fetchLatestVersion({
      currentVersion,
      packageName: PACKAGE_NAME,
    });

    if (!latestVersion) {
      console.error(
        `${pc.red("✗")} Could not check for updates. Please check your network connection.`
      );
      process.exit(1);
    }

    if (
      !isNewerVersion({ candidate: latestVersion, current: currentVersion })
    ) {
      console.error(
        `${pc.green("✓")} ${PACKAGE_NAME} is already up to date (v${currentVersion})`
      );
      return;
    }

    console.error(
      `Updating ${PACKAGE_NAME} (${pc.dim(`v${currentVersion}`)} → ${pc.green(`v${latestVersion}`)})...`
    );

    runUpdate({ currentVersion, latestVersion });
  },
});
