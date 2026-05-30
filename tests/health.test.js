import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';

import { run } from '../src/commands/health.js';

const TEMP_ROOT = path.join(process.cwd(), '.health-test-repos');

function createStdoutCapture() {
  let output = '';

  return {
    stdout: {
      write(chunk) {
        output += String(chunk);
      },
    },
    getOutput() {
      return output;
    },
  };
}

async function createTempRepo(prefix) {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  return fs.mkdtemp(path.join(TEMP_ROOT, prefix));
}

after(async () => {
  await fs.rm(TEMP_ROOT, { recursive: true, force: true });
});

test('run returns full score when all health signals exist', async (t) => {
  const repoDir = await createTempRepo('positive-');
  t.after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(repoDir, 'README.md'), '# Demo');
  await fs.mkdir(path.join(repoDir, 'tests'), { recursive: true });
  await fs.writeFile(path.join(repoDir, 'tests', 'unit.test.js'), 'export {};');
  await fs.mkdir(path.join(repoDir, '.github', 'workflows'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(repoDir, '.github', 'workflows', 'ci.yml'),
    'name: CI',
  );
  await fs.writeFile(path.join(repoDir, '.gitignore'), 'node_modules/');
  await fs.writeFile(path.join(repoDir, 'package-lock.json'), '{}');

  const capture = createStdoutCapture();
  const result = await run({ cwd: repoDir, stdout: capture.stdout });
  const output = capture.getOutput();

  assert.equal(result.score, 5);
  assert.equal(result.total, 5);
  assert.equal(result.percentage, 100);
  assert.match(output, /✓ README\.md/);
  assert.match(output, /✓ tests directory\/files/);
  assert.match(output, /✓ CI workflow/);
  assert.match(output, /✓ \.gitignore/);
  assert.match(output, /✓ package-lock\.json/);
  assert.match(output, /Total score: 5\/5 \(100%\)/);
});

test('run reports partial score when several health signals are missing', async (t) => {
  const repoDir = await createTempRepo('negative-');
  t.after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(repoDir, 'README.md'), '# Demo');
  await fs.writeFile(path.join(repoDir, '.gitignore'), 'node_modules/');

  const capture = createStdoutCapture();
  const result = await run({ cwd: repoDir, stdout: capture.stdout });
  const output = capture.getOutput();

  assert.equal(result.score, 2);
  assert.equal(result.total, 5);
  assert.equal(result.percentage, 40);
  assert.match(output, /✓ README\.md/);
  assert.match(output, /✗ tests directory\/files/);
  assert.match(output, /✗ CI workflow/);
  assert.match(output, /✓ \.gitignore/);
  assert.match(output, /✗ package-lock\.json/);
  assert.match(output, /Total score: 2\/5 \(40%\)/);
});
