#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runChangelog } from '../src/commands/changelog.js';
import { run as runLicense } from '../src/commands/license.js';
import { run as runHealth } from '../src/commands/health.js';
import { run as runStats } from '../src/commands/stats.js';
import { run as runSecrets } from '../src/commands/secrets.js';

const COMMANDS = {
  changelog: runChangelog,
  license: runLicense,
  health: runHealth,
  stats: runStats,
  secrets: runSecrets,
};

function usage() {
  return 'Usage: devkit <changelog|license|health|stats|secrets>\n';
}

function toExitCode(result) {
  if (result === undefined) {
    return 0;
  }

  if (typeof result === 'number' && Number.isInteger(result)) {
    return result;
  }

  return 0;
}

export async function main(argv = process.argv, { stderr = process.stderr } = {}) {
  const commandName = argv[2];

  if (!commandName || !Object.hasOwn(COMMANDS, commandName)) {
    stderr.write(usage());
    return 1;
  }

  try {
    const result = await COMMANDS[commandName]();
    return toExitCode(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`devkit ${commandName}: ${message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
