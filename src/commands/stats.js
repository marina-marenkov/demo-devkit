import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules']);

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function extensionFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension || '<no-ext>';
}

function countLines(content) {
  if (content.length === 0) {
    return 0;
  }

  const normalized = content.replace(/\r\n/g, '\n');
  let lines = 0;

  for (const char of normalized) {
    if (char === '\n') {
      lines += 1;
    }
  }

  return normalized.endsWith('\n') ? lines : lines + 1;
}

export async function walkFiles(rootDir, { fs: fsImpl = fs } = {}) {
  const files = [];

  async function visit(currentDir) {
    const entries = await fsImpl.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(fullPath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(normalizePath(path.relative(rootDir, fullPath)));
      }
    }
  }

  await visit(rootDir);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function formatLinesByExtension(entries) {
  const rows = ['Lines by extension:'];

  for (const [extension, lines] of entries) {
    rows.push(`${extension} ${lines}`);
  }

  return rows.join('\n');
}

function formatBiggestFiles(files) {
  const rows = ['Top 5 biggest files:'];

  for (const file of files) {
    rows.push(`${file.size} ${file.path}`);
  }

  return rows.join('\n');
}

export async function run({
  cwd = process.cwd(),
  fs: fsImpl = fs,
  walk = walkFiles,
  stdout = process.stdout,
} = {}) {
  const files = await walk(cwd, { fs: fsImpl });
  const linesByExtension = new Map();
  const sizes = [];

  for (const relativeFile of files) {
    const absoluteFile = path.join(cwd, relativeFile);
    const [content, stats] = await Promise.all([
      fsImpl.readFile(absoluteFile, 'utf8'),
      fsImpl.stat(absoluteFile),
    ]);
    const extension = extensionFor(relativeFile);

    linesByExtension.set(extension, (linesByExtension.get(extension) ?? 0) + countLines(content));
    sizes.push({ path: normalizePath(relativeFile), size: stats.size });
  }

  const sortedExtensions = [...linesByExtension.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
  const biggestFiles = sizes
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    .slice(0, 5);

  const output = `${formatLinesByExtension(sortedExtensions)}\n\n${formatBiggestFiles(biggestFiles)}\n`;
  stdout.write(output);

  return { linesByExtension: sortedExtensions, biggestFiles };
}
