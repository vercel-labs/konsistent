import { defineCommand } from "citty";
import pc from "picocolors";
import { PACKAGE_NAME } from "../update/package-name.js";
import { fetchLatestRelease } from "../update/registry.js";
import {
  isReleaseOldEnough,
  readMinimumReleaseAgeMs,
} from "../update/release-age.js";
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

    const release = await fetchLatestRelease({
      currentVersion,
      packageName: PACKAGE_NAME,
    });

    if (!release) {
      console.error(
        `${pc.red("✗")} Could not check for updates. Please check your network connection.`
      );
      process.exit(1);
    }

    const latestVersion = release.version;

    if (
      !isNewerVersion({ candidate: latestVersion, current: currentVersion })
    ) {
      console.error(
        `${pc.green("✓")} ${PACKAGE_NAME} is already up to date (v${currentVersion})`
      );
      return;
    }

    const minimumReleaseAgeMs =
      readMinimumReleaseAgeMs({ cwd: process.cwd(), latestVersion }) ?? 0;
    /*
     * Missing publication timestamps should never occur in practice. This
     * defensive check allows explicit updates if registry metadata is incomplete
     * or malformed, since it cannot prove the release is too recent.
     */
    if (release.publishedAt === null) {
      console.warn(
        `Warning: Could not verify the publication time of ${PACKAGE_NAME} v${latestVersion}. Proceeding without checking its minimum release age.`
      );
    } else if (
      !isReleaseOldEnough({
        minimumReleaseAgeMs,
        publishedAt: release.publishedAt,
      })
    ) {
      const eligibleAt = new Date(release.publishedAt + minimumReleaseAgeMs);
      const eligibility = Number.isFinite(eligibleAt.getTime())
        ? ` Eligible at ${eligibleAt.toISOString()}.`
        : "";
      console.error(
        `${pc.red("✗")} ${PACKAGE_NAME} v${latestVersion} has not reached the repository's minimum release age.${eligibility} Update was not attempted.`
      );
      process.exitCode = 1;
      return;
    }

    console.error(
      `Updating ${PACKAGE_NAME} (${pc.dim(`v${currentVersion}`)} → ${pc.green(`v${latestVersion}`)})...`
    );

    runUpdate({ currentVersion, latestVersion });
  },
});
