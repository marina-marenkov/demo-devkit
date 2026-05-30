import test from 'node:test';
import assert from 'node:assert/strict';

import { run } from '../src/commands/changelog.js';

function createCaptureStream() {
  return {
    chunks: [],
    write(chunk) {
      this.chunks.push(String(chunk));
      return true;
    },
    toString() {
      return this.chunks.join('');
    }
  };
}

test('run groups conventional commits into changelog sections', async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  const exitCode = await run({
    commitSubjects: [
      'feat(cli): add changelog command',
      'fix: handle git failures',
      'docs: update usage docs',
      'Merge branch main into feature'
    ],
    stdout,
    stderr,
    exec: async () => {
      throw new Error('exec should not be called when commitSubjects are injected');
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');

  const output = stdout.toString();
  assert.match(output, /# Changelog/);
  assert.match(output, /## Features\n- \*\*cli:\*\* add changelog command/);
  assert.match(output, /## Bug Fixes\n- handle git failures/);
  assert.match(output, /## Documentation\n- update usage docs/);
  assert.doesNotMatch(output, /Merge branch/);
});

test('run emits fallback message when no conventional commits exist', async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  const exitCode = await run({
    commitSubjects: ['Merge pull request #1', 'release v1.2.0'],
    stdout,
    stderr
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');
  assert.match(stdout.toString(), /_No conventional commits found\._/);
});

test('run executes git log with cwd when commitSubjects are not injected', async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  const calls = [];
  const exitCode = await run({
    cwd: '/example/repo',
    stdout,
    stderr,
    exec: async (...args) => {
      calls.push(args);
      return { stdout: 'feat: add command\nfix(parser): prevent crash' };
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    'git',
    ['log', '--pretty=format:%s'],
    { cwd: '/example/repo' }
  ]);

  const output = stdout.toString();
  assert.match(output, /## Features\n- add command/);
  assert.match(output, /## Bug Fixes\n- \*\*parser:\*\* prevent crash/);
});

test('run reports git command errors to stderr and returns non-zero', async () => {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  const exitCode = await run({
    stdout,
    stderr,
    exec: async () => {
      throw new Error('fatal: not a git repository');
    }
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.toString(), '');
  assert.match(stderr.toString(), /Failed to generate changelog from git log:/);
  assert.match(stderr.toString(), /fatal: not a git repository/);
});
