# devkit

`devkit` is a Node.js CLI for quick repository diagnostics.

## Local repo setup and run

From this repository root:

```bash
npm install
```

Run directly without linking:

```bash
node ./bin/devkit.js <command>
```

Or expose the `devkit` command locally:

```bash
npm link
```

Usage:

```text
devkit <changelog|license|health|stats|secrets>
```

If you run an unknown command (or no command), it prints usage and exits with code `1`.

## Command examples

### `devkit changelog`
Builds a changelog from `git log --pretty=format:%s` using Conventional Commit types.

```bash
devkit changelog
```

Example output:

```text
# Changelog

## Features
- **cli:** add changelog command

## Bug Fixes
- handle git failures
```

If no conventional commits are found, it prints:

```text
_No conventional commits found._
```

### `devkit license`
Scans `node_modules/**/package.json` and prints unique, normalized licenses sorted alphabetically.

```bash
devkit license
```

Example output:

```text
Apache-2.0
BSD-3-Clause
ISC
MIT
```

Note: this command requires a `node_modules` directory. If missing, it exits with code `1` and prints an error.

### `devkit health`
Checks for 5 repo health signals: `README.md`, tests, CI workflow, `.gitignore`, and `package-lock.json`.

```bash
devkit health
```

Example output:

```text
✓ README.md
✓ tests directory/files
✗ CI workflow
✗ .gitignore
✗ package-lock.json
Total score: 2/5 (40%)
```

### `devkit stats`
Counts lines by file extension and shows the top 5 biggest files (bytes), excluding `.git` and `node_modules` directories.

```bash
devkit stats
```

Example output:

```text
Lines by extension:
.js 1156
.json 10
.md 129

Top 5 biggest files:
3556 src/commands/changelog.js
3297 src/commands/secrets.js
...
```

### `devkit secrets`
Scans git-tracked files (`git ls-files`) for common secret patterns (AWS access keys, GitHub tokens, generic credential assignments).

```bash
devkit secrets
```

Example output when clean:

```text
No suspicious secrets found in tracked files.
```

If matches are found, it reports `file:line [pattern]`, prints a total, and exits with code `1`.  
If `git ls-files` fails (for example outside a git repo), it exits with code `2`.
