# How devkit works

`devkit` is a small Node.js CLI with no runtime dependencies. It dispatches one command at a time and returns command-specific exit codes so it can be used both interactively and in CI scripts.

## Runtime flow

1. The executable entrypoint is `bin/devkit.js`.
2. It maps command names to handlers from `src/commands/*.js`.
3. It validates the command and prints usage for unknown/missing commands.
4. It executes the selected handler and normalizes the returned value into a process exit code.
5. Unexpected handler errors are printed as `devkit <command>: <message>` and exit with code `1`.

## Project structure

```text
bin/devkit.js                # CLI entrypoint and command dispatch
src/commands/changelog.js    # Conventional-commit changelog generation
src/commands/license.js      # License scan from node_modules package.json files
src/commands/health.js       # Repository hygiene checks + score
src/commands/stats.js        # File line counts by extension + biggest files
src/commands/secrets.js      # Pattern-based secrets scan on tracked files
tests/*.test.js              # Node test runner coverage per command
```

## Command internals

### `changelog`

- Reads commit subjects from `git log --pretty=format:%s`.
- Parses Conventional Commit headers (`type(scope)!: description`).
- Groups entries by commit type, using a predefined order for common sections.
- Prints a markdown changelog with a fallback message when no conventional commits are found.

### `license`

- Requires `node_modules` to exist.
- Recursively traverses `node_modules` and reads every `package.json`.
- Extracts licenses from `license` and `licenses` fields (supports strings, arrays, and objects).
- Normalizes and deduplicates values case-insensitively, then prints them sorted.
- Returns exit code `1` when `node_modules` is missing.

### `health`

Runs five checks and computes a score:

- `README.md` exists
- tests exist (either `tests/` with files or discovered `*.test|*.spec` files)
- CI workflow exists in `.github/workflows/*.yml|*.yaml`
- `.gitignore` exists
- `package-lock.json` exists

Output is a check list plus `Total score: X/5 (Y%)`.

### `stats`

- Walks all files recursively from project root, excluding `.git` and `node_modules`.
- Counts lines grouped by file extension (`<no-ext>` for extensionless files).
- Computes file sizes and prints the top 5 largest files.

### `secrets`

- Retrieves tracked files using `git ls-files`.
- Reads files and skips binary content.
- Scans each line against built-in regex patterns:
  - AWS access key IDs
  - GitHub tokens
  - Generic token/secret assignments
- Prints findings as `<path>:<line> [pattern-label]`.
- Exit codes:
  - `0`: no findings
  - `1`: findings detected
  - `2`: failed to enumerate tracked files

## Testing model

- Tests use Node's built-in test runner (`node --test`).
- Each command has focused tests under `tests/*.test.js`.
- Command modules are written to allow dependency injection (for `fs`, `exec`, streams), which keeps tests deterministic.
