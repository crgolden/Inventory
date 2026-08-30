'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const npmCliBesideThisNode = path.join(
  path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const script = process.platform === 'win32' ? 'start:windows' : 'start:default';
const result = spawnSync(process.execPath, [npmCliBesideThisNode, 'run', script], { stdio: 'inherit' });
process.exit(result.status ?? 1);
