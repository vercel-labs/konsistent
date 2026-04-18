import { defineCommand } from 'citty';
import pc from 'picocolors';
import { PACKAGE_NAME } from '../update/package-name.js';
import { fetchLatestVersion } from '../update/registry.js';
import { runUpdate } from '../update/run-update.js';
import { isNewerVersion } from '../update/semver.js';
import { getVersion } from '../version.js';

export default defineCommand({
  meta: {
    name: 'update',
    description: 'Update konsistent to the latest version',
  },
  async run() {
    const currentVersion = getVersion();

    console.error('Checking for updates...');

    const latestVersion = await fetchLatestVersion({
      packageName: PACKAGE_NAME,
      currentVersion,
    });

    if (!latestVersion) {
      console.error(
        `${pc.red('✗')} Could not check for updates. Please check your network connection.`
      );
      process.exit(1);
    }

    if (
      !isNewerVersion({ current: currentVersion, candidate: latestVersion })
    ) {
      console.error(
        `${pc.green('✓')} ${PACKAGE_NAME} is already up to date (v${currentVersion})`
      );
      return;
    }

    console.error(
      `Updating ${PACKAGE_NAME} (${pc.dim(`v${currentVersion}`)} → ${pc.green(`v${latestVersion}`)})...`
    );

    runUpdate({ currentVersion, latestVersion });
  },
});
