import { defineCommand, runMain } from 'citty';
import { getVersion } from './version.js';

const SUBCOMMANDS = new Set(['check', 'validate', 'version']);

const main = defineCommand({
  meta: {
    name: 'konsistent',
    version: getVersion(),
    description: 'Enforce structural conventions in TypeScript codebases',
  },
  subCommands: {
    check: () => import('./commands/check.js').then((m) => m.default),
    validate: () => import('./commands/validate.js').then((m) => m.default),
    version: () => import('./commands/version.js').then((m) => m.default),
  },
});

const rawArgs = process.argv.slice(2);
const hasSubCommand = rawArgs.some(
  (arg) => !arg.startsWith('-') && SUBCOMMANDS.has(arg)
);
const hasHelpFlag = rawArgs.includes('--help') || rawArgs.includes('-h');
const hasVersionFlag = rawArgs.length === 1 && rawArgs[0] === '--version';

if (hasVersionFlag) {
  console.log(getVersion());
} else {
  if (!hasSubCommand && !hasHelpFlag) {
    rawArgs.unshift('check');
  }
  runMain(main, { rawArgs });
}
