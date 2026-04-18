export {
  checkAndPrompt,
  shouldCheckForUpdate,
  formatNotification,
} from './notifier.js';
export {
  runUpdate,
  canAutoUpdate,
  getManualInstallHint,
} from './run-update.js';
export { fetchLatestVersion, findLatestInChannel } from './registry.js';
export {
  parseVersion,
  compareVersions,
  getPrereleaseChannel,
  isNewerVersion,
  versionSatisfiesRange,
} from './semver.js';
export { readCache, writeCache, getCachePath, isCacheStale } from './cache.js';
export {
  detectPackageManager,
  getInstallCommand,
  getGlobalInstallCommand,
  isGlobalInstall,
  isMonorepo,
  isPackageInDeps,
  updatePackageJsonVersion,
} from './package-manager.js';
export { promptYesNo } from './prompt.js';
export { PACKAGE_NAME } from './package-name.js';
