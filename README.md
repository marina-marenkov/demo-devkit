# devkit

`devkit` is a zero-dependency Node.js command-line tool that helps you inspect repository quality, activity, and risk quickly.

## Project purpose

This project is meant to be a lightweight "developer toolbox" for local repositories.  
Instead of installing multiple heavy tools, `devkit` provides a small set of focused checks:

- release visibility (`changelog`)
- dependency license visibility (`license`)
- repository hygiene checks (`health`)
- source size/codebase profile (`stats`)
- accidental secret detection (`secrets`)

It is designed for local development workflows, pre-PR checks, and CI smoke checks.

## Quick start

From repository root:

```bash
npm install
```

Run directly:

```bash
node ./bin/devkit.js <command>
```

Or link globally for local usage:

```bash
npm link
devkit <command>
```

Supported commands:

```text
devkit <changelog|license|health|stats|secrets>
```

If command is missing or unknown, usage is printed and process exits with code `1`.

## Usage examples

### `devkit changelog`
Generate changelog sections from Conventional Commit messages in `git log`.

```bash
devkit changelog
```

Save output to a file:

```bash
devkit changelog > CHANGELOG.generated.md
```

### `devkit license`
Scan `node_modules/**/package.json` and print unique licenses (sorted).

```bash
devkit license
```

Use in CI to snapshot licenses:

```bash
devkit license > licenses.txt
```

### `devkit health`
Check repository health based on:
- `README.md`
- tests
- CI workflow (`.github/workflows/*.yml|*.yaml`)
- `.gitignore`
- `package-lock.json`

```bash
devkit health
```

Example:

```text
✓ README.md
✓ tests directory/files
✗ CI workflow
✓ .gitignore
✓ package-lock.json
Total score: 4/5 (80%)
```

### `devkit stats`
Show lines-per-extension and top 5 largest files by bytes.

```bash
devkit stats
```

Use for quick refactor targeting:

```bash
devkit stats | head -n 20
```

### `devkit secrets`
Scan git-tracked files for token/key-like patterns.

```bash
devkit secrets
```

Pre-commit/pre-push usage:

```bash
devkit secrets && echo "No obvious secrets found"
```

## Exit behavior notes

- `license` exits non-zero when `node_modules` is missing.
- `secrets` exits `1` when potential secrets are found, `0` when clean, and `2` when tracked files cannot be resolved with git.

## Documentation

Project internals and architecture are documented in:

- `docs/how-it-works.md`
