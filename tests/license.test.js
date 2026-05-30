import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { run } from '../src/commands/license.js';

async function makeFixture(name) {
  return mkdtemp(path.join(process.cwd(), `.license-${name}-`));
}

async function writeJson(filePath, json) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(json), 'utf8');
}

function createCollector() {
  const chunks = [];
  return {
    stream: {
      write(chunk) {
        chunks.push(String(chunk));
        return true;
      }
    },
    value() {
      return chunks.join('');
    }
  };
}

test('run lists unique normalized licenses sorted alphabetically', async (t) => {
  const root = await makeFixture('licenses');
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  await writeJson(path.join(root, 'node_modules/pkg-a/package.json'), {
    name: 'pkg-a',
    license: 'MIT'
  });
  await writeJson(path.join(root, 'node_modules/pkg-b/package.json'), {
    name: 'pkg-b',
    license: { type: 'Apache-2.0', url: 'https://example.com' }
  });
  await writeJson(path.join(root, 'node_modules/@scope/pkg-c/package.json'), {
    name: '@scope/pkg-c',
    licenses: [{ type: 'MIT' }, 'BSD-3-Clause', { name: 'Apache-2.0' }]
  });
  await writeJson(path.join(root, 'node_modules/pkg-d/node_modules/pkg-e/package.json'), {
    name: 'pkg-e',
    licenses: { type: 'ISC' }
  });
  await writeJson(path.join(root, 'node_modules/pkg-f/package.json'), {
    name: 'pkg-f',
    license: '  (MIT)  '
  });

  const stdout = createCollector();
  const stderr = createCollector();

  const exitCode = await run({
    cwd: root,
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.value(), '');
  assert.deepEqual(stdout.value().trim().split('\n'), [
    'Apache-2.0',
    'BSD-3-Clause',
    'ISC',
    'MIT'
  ]);
});

test('run returns non-zero with clear message when node_modules is missing', async (t) => {
  const root = await makeFixture('missing-node-modules');
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const stdout = createCollector();
  const stderr = createCollector();

  const exitCode = await run({
    cwd: root,
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.value(), '');
  assert.match(stderr.value(), /node_modules directory not found/i);
});
