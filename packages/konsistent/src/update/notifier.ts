import pc from "picocolors";
import { isCacheStale, readCache, writeCache } from "./cache.js";
import { detectPackageManager, isMonorepo } from "./package-manager.js";
import { PACKAGE_NAME } from "./package-name.js";
import { promptYesNo } from "./prompt.js";
import { fetchLatestVersion } from "./registry.js";
import {
  canAutoUpdate,
  getManualInstallHint,
  runUpdate,
} from "./run-update.js";
import { isNewerVersion } from "./semver.js";

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
  let latestVersion: string | null;

  if (isCacheStale({ cache })) {
    latestVersion = await fetchLatestVersion({
      packageName: PACKAGE_NAME,
      currentVersion: opts.currentVersion,
    });

    if (latestVersion) {
      writeCache({ lastChecked: Date.now(), latestVersion });
    }
  } else {
    latestVersion = cache?.latestVersion ?? null;
  }

  if (
    !(
      latestVersion &&
      isNewerVersion({
        current: opts.currentVersion,
        candidate: latestVersion,
      })
    )
  ) {
    return false;
  }

  console.error(
    formatNotification({
      currentVersion: opts.currentVersion,
      latestVersion,
    })
  );

  const cwd = process.cwd();
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
