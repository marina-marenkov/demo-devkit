import test from 'node:test';
import assert from 'node:assert/strict';

import { run } from '../src/commands/secrets.js';

function createStreamCapture() {
  let output = '';
  return {
    stream: {
      write(chunk) {
        output += String(chunk);
      },
    },
    read() {
      return output;
    },
  };
}

test('detects representative secret patterns and returns non-zero', async () => {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  const files = {
    '.env': 'AWS_KEY=AKIA1234567890ABCDEF\n',
    'src/config.js': 'const token = "ghp_1234567890abcdef1234567890abcdef1234";\n',
    'settings.ini': 'api_key = "abcde12345abcde12345"\n',
  };

  const code = await run([], {
    cwd: '/fake-repo',
    stdout: stdout.stream,
    stderr: stderr.stream,
    getTrackedFiles: async () => Object.keys(files),
    readFile: async (filePath) => files[filePath],
  });

  assert.equal(code, 1);
  const out = stdout.read();
  assert.match(out, /\.env:1 \[aws-access-key-id\]/);
  assert.match(out, /src\/config\.js:1 \[github-token\]/);
  assert.match(out, /settings\.ini:1 \[generic-credential-assignment\]/);
  assert.equal(stderr.read(), '');
});

test('returns zero and clean message when no findings exist', async () => {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  const files = {
    'README.md': '# Demo project\nNo secrets here.\n',
    'src/index.js': 'const token = process.env.TOKEN;\n',
  };

  const code = await run([], {
    stdout: stdout.stream,
    stderr: stderr.stream,
    getTrackedFiles: async () => Object.keys(files),
    readFile: async (filePath) => files[filePath],
  });

  assert.equal(code, 0);
  assert.match(stdout.read(), /No suspicious secrets found/);
  assert.equal(stderr.read(), '');
});

test('prints clear stderr output when git listing fails', async () => {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  const code = await run([], {
    stdout: stdout.stream,
    stderr: stderr.stream,
    getTrackedFiles: async () => {
      throw new Error('fatal: not a git repository');
    },
  });

  assert.equal(code, 2);
  assert.equal(stdout.read(), '');
  assert.match(stderr.read(), /failed to list tracked files with git ls-files/i);
  assert.match(stderr.read(), /not a git repository/i);
});
