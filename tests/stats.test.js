/**
 * Tests for the `stats` command (`src/commands/stats.js`).
 *
 * Covers:
 *  - Line counts per file extension across a mixed set of text and binary files
 *  - Identification of the five largest files sorted by byte size
 *  - Formatted stdout output combining both summaries
 *
 * The test creates a temporary directory populated with fixture files and
 * removes it on completion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { run } from '../src/commands/stats.js';

const fixtureFiles = [
  { filePath: 'src/app.js', content: 'a\nb\nc\n' },
  { filePath: 'src/util.js', content: 'd\ne\n' },
  { filePath: 'README.md', content: 'line1\nline2\nline3' },
  { filePath: 'notes.txt', content: 'note-one\nnote-two\nnote-three\nnote-four\n' },
  { filePath: 'data.json', content: '{"a":1}\n' },
  { filePath: 'assets/big.bin', content: Buffer.alloc(120, 65) },
  { filePath: 'tiny.bin', content: Buffer.alloc(10, 66) },
  { filePath: 'LICENSE', content: 'license text' },
];

/**
 * Writes all `fixtureFiles` into `baseDir`, creating subdirectories as needed.
 *
 * @param {string} baseDir - Root directory to populate with fixture files.
 * @returns {Promise<void>}
 */
async function createFixtureDirectory(baseDir) {
  for (const fixture of fixtureFiles) {
    const absolutePath = path.join(baseDir, fixture.filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, fixture.content);
  }
}

/**
 * Converts an array of `[key, value]` pairs into a plain object.
 *
 * @param {Array<[string, unknown]>} entries - Key/value pairs to convert.
 * @returns {Record<string, unknown>}
 */
function mapFromEntries(entries) {
  return Object.fromEntries(entries);
}

test('run reports extension line totals and top-5 biggest files', async () => {
  const tempRoot = await fs.mkdtemp(path.join(process.cwd(), 'tests/.tmp-stats-'));
  const output = [];

  try {
    await createFixtureDirectory(tempRoot);
    const result = await run({
      cwd: tempRoot,
      stdout: {
        write(chunk) {
          output.push(chunk);
        },
      },
    });

    assert.deepEqual(mapFromEntries(result.linesByExtension), {
      '.bin': 2,
      '.js': 5,
      '.json': 1,
      '.md': 3,
      '.txt': 4,
      '<no-ext>': 1,
    });

    assert.deepEqual(result.biggestFiles, [
      { path: 'assets/big.bin', size: 120 },
      { path: 'notes.txt', size: 39 },
      { path: 'README.md', size: 17 },
      { path: 'LICENSE', size: 12 },
      { path: 'tiny.bin', size: 10 },
    ]);

    assert.equal(
      output.join(''),
      `Lines by extension:
.bin 2
.js 5
.json 1
.md 3
.txt 4
<no-ext> 1

Top 5 biggest files:
120 assets/big.bin
39 notes.txt
17 README.md
12 LICENSE
10 tiny.bin
`,
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
