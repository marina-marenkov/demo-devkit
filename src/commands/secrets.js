import { execFile } from 'node:child_process';
import { readFile as readFileFs } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PATTERNS = [
  {
    label: 'aws-access-key-id',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    label: 'github-token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    label: 'generic-credential-assignment',
    regex: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret)\b\s*[:=]\s*(?:["'`])?[A-Za-z0-9_-]{16,}(?:["'`])?/gi,
  },
];

async function getTrackedFilesFromGit({ cwd }) {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files'], { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    const details = [error?.stderr, error?.message].filter(Boolean).join(' ').trim();
    throw new Error(details || 'git ls-files failed');
  }
}

async function defaultReadFile(filePath, { cwd }) {
  return readFileFs(path.join(cwd, filePath));
}

function toText(content) {
  if (typeof content === 'string') {
    return content;
  }

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString('utf8');
}

function collectFindings(filePath, text) {
  const findings = [];
  const dedupe = new Set();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const pattern of PATTERNS) {
      for (const match of line.matchAll(pattern.regex)) {
        if (!match[0]) {
          continue;
        }

        const key = `${filePath}:${index + 1}:${pattern.label}`;
        if (dedupe.has(key)) {
          continue;
        }
        dedupe.add(key);
        findings.push({ filePath, lineNumber: index + 1, label: pattern.label });
      }
    }
  }

  return findings;
}

export async function run(_args = [], options = {}) {
  const {
    cwd = process.cwd(),
    stdout = process.stdout,
    stderr = process.stderr,
    getTrackedFiles = getTrackedFilesFromGit,
    readFile = defaultReadFile,
  } = options;

  let trackedFiles;
  try {
    trackedFiles = await getTrackedFiles({ cwd, stderr });
  } catch (error) {
    stderr.write(`devkit secrets: failed to list tracked files with git ls-files: ${error.message}\n`);
    return 2;
  }

  const findings = [];

  for (const filePath of trackedFiles) {
    try {
      const content = await readFile(filePath, { cwd });
      const text = toText(content);
      if (text === null) {
        continue;
      }
      findings.push(...collectFindings(filePath, text));
    } catch (error) {
      stderr.write(`devkit secrets: failed to read ${filePath}: ${error.message}\n`);
    }
  }

  if (findings.length > 0) {
    stdout.write('Potential secrets detected:\n');
    for (const finding of findings) {
      stdout.write(`${finding.filePath}:${finding.lineNumber} [${finding.label}]\n`);
    }
    stdout.write(`Found ${findings.length} potential secret(s).\n`);
    return 1;
  }

  stdout.write('No suspicious secrets found in tracked files.\n');
  return 0;
}
