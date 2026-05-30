import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const SECTION_TITLES = new Map([
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['docs', 'Documentation'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['test', 'Tests'],
  ['build', 'Build System'],
  ['ci', 'Continuous Integration'],
  ['chore', 'Chores'],
  ['style', 'Styles'],
  ['revert', 'Reverts']
]);

const SECTION_ORDER = [
  'feat',
  'fix',
  'docs',
  'perf',
  'refactor',
  'test',
  'build',
  'ci',
  'chore',
  'style',
  'revert'
];

function parseConventionalCommit(subject) {
  const match = /^(?<type>[a-z][a-z0-9-]*)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<description>.+)$/i.exec(subject.trim());
  if (!match?.groups) {
    return null;
  }

  return {
    type: match.groups.type.toLowerCase(),
    scope: match.groups.scope ?? null,
    description: match.groups.description.trim(),
    breaking: Boolean(match.groups.breaking)
  };
}

function toSectionTitle(type) {
  if (SECTION_TITLES.has(type)) {
    return SECTION_TITLES.get(type);
  }

  return type
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function groupCommits(subjects) {
  const grouped = new Map();

  for (const subject of subjects) {
    const parsed = parseConventionalCommit(subject);
    if (!parsed) {
      continue;
    }

    if (!grouped.has(parsed.type)) {
      grouped.set(parsed.type, []);
    }

    grouped.get(parsed.type).push(parsed);
  }

  return grouped;
}

function getOrderedTypes(grouped) {
  const knownTypes = SECTION_ORDER.filter((type) => grouped.has(type));
  const unknownTypes = [...grouped.keys()]
    .filter((type) => !SECTION_ORDER.includes(type))
    .sort((a, b) => a.localeCompare(b));

  return [...knownTypes, ...unknownTypes];
}

function renderChangelog(grouped) {
  const lines = ['# Changelog', ''];
  const orderedTypes = getOrderedTypes(grouped);

  if (orderedTypes.length === 0) {
    lines.push('_No conventional commits found._');
    return lines.join('\n');
  }

  for (const type of orderedTypes) {
    lines.push(`## ${toSectionTitle(type)}`);

    for (const commit of grouped.get(type)) {
      const scopePrefix = commit.scope ? `**${commit.scope}:** ` : '';
      const breakingSuffix = commit.breaking ? ' ⚠️ BREAKING' : '';
      lines.push(`- ${scopePrefix}${commit.description}${breakingSuffix}`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function normalizeSubjects(input) {
  if (Array.isArray(input)) {
    return input.map((line) => String(line));
  }

  if (typeof input === 'string') {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

export async function run({
  cwd = process.cwd(),
  exec = execFile,
  stdout = process.stdout,
  stderr = process.stderr,
  commitSubjects
} = {}) {
  let subjects = commitSubjects;

  if (subjects === undefined) {
    try {
      const result = await exec('git', ['log', '--pretty=format:%s'], { cwd });
      subjects = result.stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`Failed to generate changelog from git log: ${message}\n`);
      return 1;
    }
  }

  const grouped = groupCommits(normalizeSubjects(subjects));
  const output = renderChangelog(grouped);
  stdout.write(`${output}\n`);
  return 0;
}
