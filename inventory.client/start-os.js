'use strict';
const { spawnSync } = require('node:child_process');

const npmCliRunningThisScript = process.env.npm_execpath;
if (!npmCliRunningThisScript) {
  throw new Error('start-os.js must run under npm (npm start), which sets npm_execpath to its own npm-cli.js.');
}
const script = process.platform === 'win32' ? 'start:windows' : 'start:default';
const result = spawnSync(process.execPath, [npmCliRunningThisScript, 'run', script], { stdio: 'inherit' });
process.exit(result.status ?? 1);
