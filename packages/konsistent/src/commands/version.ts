import { defineCommand } from 'citty';
import { getVersion } from '../version.js';

export default defineCommand({
  meta: {
    name: 'version',
    description: 'Print the version number',
  },
  run() {
    console.log(getVersion());
  },
});
