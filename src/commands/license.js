import path from 'node:path';
import { promises as fs } from 'node:fs';

function normalizeLicense(value) {
  if (typeof value !== 'string') {
    return null;
  }

  let normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized || null;
}

function extractLicenseValues(input) {
  if (!input) {
    return [];
  }

  if (typeof input === 'string') {
    return [input];
  }

  if (Array.isArray(input)) {
    return input.flatMap((entry) => extractLicenseValues(entry));
  }

  if (typeof input === 'object') {
    const keys = ['type', 'name', 'license', 'id', 'spdx'];
    return keys
      .filter((key) => typeof input[key] === 'string')
      .map((key) => input[key]);
  }

  return [];
}

async function collectLicensesFromNodeModules(nodeModulesPath, fsModule) {
  const queue = [nodeModulesPath];
  const normalizedByKey = new Map();

  while (queue.length > 0) {
    const currentDir = queue.pop();
    let entries;

    try {
      entries = await fsModule.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile() || entry.name !== 'package.json') {
        continue;
      }

      let packageJson;
      try {
        packageJson = JSON.parse(await fsModule.readFile(fullPath, 'utf8'));
      } catch {
        continue;
      }

      const candidates = [
        ...extractLicenseValues(packageJson.license),
        ...extractLicenseValues(packageJson.licenses)
      ];

      for (const candidate of candidates) {
        const normalized = normalizeLicense(candidate);
        if (!normalized) {
          continue;
        }

        const key = normalized.toLowerCase();
        if (!normalizedByKey.has(key)) {
          normalizedByKey.set(key, normalized);
        }
      }
    }
  }

  return [...normalizedByKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

export async function run({
  cwd = process.cwd(),
  fsModule = fs,
  stdout = process.stdout,
  stderr = process.stderr
} = {}) {
  const nodeModulesPath = path.join(cwd, 'node_modules');

  try {
    const stats = await fsModule.stat(nodeModulesPath);
    if (!stats.isDirectory()) {
      stderr.write(`node_modules directory not found: ${nodeModulesPath}\n`);
      return 1;
    }
  } catch {
    stderr.write(`node_modules directory not found: ${nodeModulesPath}\n`);
    return 1;
  }

  const licenses = await collectLicensesFromNodeModules(nodeModulesPath, fsModule);
  for (const license of licenses) {
    stdout.write(`${license}\n`);
  }

  return 0;
}
