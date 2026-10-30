import pc from "picocolors";
import { isCacheStale, readCache, writeCache } from "./cache.js";
import { detectPackageManager, isMonorepo } from "./package-manager.js";
import { PACKAGE_NAME } from "./package-name.js";
import { promptYesNo } from "./prompt.js";
import { fetchLatestRelease, type LatestRelease } from "./registry.js";
import { isReleaseOldEnough, readMinimumReleaseAgeMs } from "./release-age.js";
import {
  canAutoUpdate,
  getManualInstallHint,
  runUpdate,
} from "./run-update.js";
import { getPrereleaseChannel, isNewerVersion } from "./semver.js";

const DEFAULT_MINIMUM_RELEASE_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export function shouldCheckForUpdate(commandName: string): boolean {
  if (commandName === "update") {
    return false;
  }
  if (process.env.CI) {
    return false;
  }
  if (process.env.KONSISTENT_NO_UPDATE_CHECK) {
    return false;
  }
  if (!process.stdin.isTTY) {
    return false;
  }
  return true;
}

export function formatNotification(opts: {
  currentVersion: string;
  latestVersion: string;
}): string {
  return `Update available for ${PACKAGE_NAME} (${pc.dim(`v${opts.currentVersion}`)} → ${pc.green(`v${opts.latestVersion}`)})`;
}

export async function checkAndPrompt(opts: {
  currentVersion: string;
}): Promise<boolean> {
  const cache = readCache();
  const channel = getPrereleaseChannel(opts.currentVersion);
  let release: LatestRelease | null;

  if (isCacheStale({ cache }) || cache?.channel !== channel) {
    release = await fetchLatestRelease({
      currentVersion: opts.currentVersion,
      packageName: PACKAGE_NAME,
    });

    if (release) {
      writeCache({
        channel,
        lastChecked: Date.now(),
        latestVersion: release.version,
        publishedAt: release.publishedAt,
      });
    }
  } else {
    release = cache
      ? { publishedAt: cache.publishedAt, version: cache.latestVersion }
      : null;
  }

  if (
    !(
      release &&
      isNewerVersion({
        candidate: release.version,
        current: opts.currentVersion,
      })
    )
  ) {
    return false;
  }

  const cwd = process.cwd();
  const latestVersion = release.version;
  const minimumReleaseAgeMs =
    readMinimumReleaseAgeMs({ cwd, latestVersion }) ??
    DEFAULT_MINIMUM_RELEASE_AGE_MS;
  if (
    !isReleaseOldEnough({
      minimumReleaseAgeMs,
      publishedAt: release.publishedAt,
    })
  ) {
    return false;
  }

  console.error(
    formatNotification({
      currentVersion: opts.currentVersion,
      latestVersion,
    })
  );

  const updateInfo = canAutoUpdate(cwd);

  if (!updateInfo) {
    const pm = detectPackageManager(cwd);
    const hint = getManualInstallHint({
      packageManager: pm,
      version: latestVersion,
      workspaceRoot: isMonorepo(cwd),
    });
    console.error(`Run the following command to update:\n  ${pc.bold(hint)}`);
    return false;
  }

  const shouldUpdate = await promptYesNo({
    question: "Would you like to update now?",
  });

  if (shouldUpdate) {
    runUpdate({
      currentVersion: opts.currentVersion,
      latestVersion,
    });
    return true;
  }

  return false;
}
