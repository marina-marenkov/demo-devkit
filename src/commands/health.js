import { promises as fs } from 'node:fs';
import path from 'node:path';

const TOTAL_CHECKS = 5;

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function hasTestFiles(rootDir) {
  const pending = [rootDir];
  const testFilePattern = /\.(test|spec)\.[cm]?[jt]s$/i;

  while (pending.length > 0) {
    const currentDir = pending.pop();
    let entries;

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }

        pending.push(entryPath);
        continue;
      }

      if (entry.isFile() && testFilePattern.test(entry.name)) {
        return true;
      }
    }
  }

  return false;
}

async function hasTests(cwd) {
  const testsDir = path.join(cwd, 'tests');

  try {
    const stats = await fs.stat(testsDir);

    if (stats.isDirectory()) {
      const entries = await fs.readdir(testsDir, { withFileTypes: true });
      if (entries.some((entry) => !entry.name.startsWith('.'))) {
        return true;
      }
    } else if (stats.isFile()) {
      return true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return hasTestFiles(cwd);
}

async function hasCiWorkflow(cwd) {
  const workflowsDir = path.join(cwd, '.github', 'workflows');

  try {
    const entries = await fs.readdir(workflowsDir, { withFileTypes: true });
    return entries.some(
      (entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name),
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

export async function run(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const stdout = options.stdout ?? process.stdout;

  const checks = [
    { name: 'README.md', passed: await isFile(path.join(cwd, 'README.md')) },
    { name: 'tests directory/files', passed: await hasTests(cwd) },
    { name: 'CI workflow', passed: await hasCiWorkflow(cwd) },
    { name: '.gitignore', passed: await isFile(path.join(cwd, '.gitignore')) },
    {
      name: 'package-lock.json',
      passed: await isFile(path.join(cwd, 'package-lock.json')),
    },
  ];

  const score = checks.filter((check) => check.passed).length;
  const percentage = Math.round((score / TOTAL_CHECKS) * 100);
  const lines = checks.map(
    (check) => `${check.passed ? '✓' : '✗'} ${check.name}`,
  );
  lines.push(`Total score: ${score}/${TOTAL_CHECKS} (${percentage}%)`);

  const report = `${lines.join('\n')}\n`;
  if (stdout && typeof stdout.write === 'function') {
    stdout.write(report);
  }

  return {
    checks,
    score,
    total: TOTAL_CHECKS,
    percentage,
    report,
  };
}
