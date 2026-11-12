#!/usr/bin/env node
// Собирает app/data.json для мини-приложения из кейсов (projects/*/README.md).
// Запуск: node tools/build.mjs

import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from './markdown.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_URL = 'https://github.com/intstage/portfolio/blob/main/';
const PET_SECTION = /^##\s+Пет-проекты/;
const INDEX_ROW = /^\|\s*\d+\s*\|\s*\[[^\]]+\]\(([^)/]+)\/?\)\s*\|\s*(.+?)\s*\|\s*$/;
const STACK_LINE = /^\*\*Стек:\*\*\s*(.+)$/m;
const TITLE_LINE = /^#\s+(.+)$/m;
const FIRST_IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)|<img\s[^>]*src="([^"]+)"/;
const CASE_DIR = /^\d{2}-/;

const isAbsolute = (url) => /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url);

// Путь из файла baseDir → путь от корня репозитория.
const fromRoot = (baseDir, url) => posix.normalize(posix.join(baseDir, url));

// Ширина и высота PNG или GIF по заголовку файла.
export function readImageSize(buffer) {
  if (buffer.length >= 24 && buffer.toString('latin1', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.toString('latin1', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  return null;
}

function localImageSize(path) {
  if (isAbsolute(path)) return null;
  try {
    return readImageSize(readFileSync(join(ROOT, path)));
  } catch (error) {
    throw new Error(`Картинка ${path} не найдена: ${error.message}`);
  }
}

export function makeResolvers(baseDir, imageSize = () => null) {
  return {
    imageSize,
    resolveSrc: (src) => (isAbsolute(src) ? src : fromRoot(baseDir, src)),
    resolveHref: (href) => {
      if (isAbsolute(href)) return href;
      const path = fromRoot(baseDir, href).replace(/\/$/, '');
      const caseMatch = /^projects\/(\d{2}-[^/]+)(\/README\.md)?$/.exec(path);
      return caseMatch ? `#/cases/${caseMatch[1]}` : REPO_URL + path;
    },
  };
}

// Таблицы в projects/README.md: краткое описание и группа (работа / пет-проект).
export function parseCaseIndex(markdown) {
  const index = new Map();
  let group = 'work';
  for (const line of markdown.split('\n')) {
    if (PET_SECTION.test(line)) group = 'pet';
    const row = INDEX_ROW.exec(line);
    if (row) index.set(row[1], { summary: row[2], group });
  }
  return index;
}

// «Пет-проект: торговый бот» → «Торговый бот»: группа и так показана над заголовком.
export function cleanTitle(title) {
  const text = title.trim().replace(/^Пет-проект:\s*/i, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildCase(id, markdown, meta = {}, imageSize = undefined) {
  const baseDir = `projects/${id}`;
  const resolvers = makeResolvers(baseDir, imageSize);
  const title = cleanTitle(TITLE_LINE.exec(markdown)?.[1] ?? id);
  const stackLine = STACK_LINE.exec(markdown)?.[1] ?? '';
  const stack = [...stackLine.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const image = FIRST_IMAGE.exec(markdown);
  const cover = image ? resolvers.resolveSrc(image[1] ?? image[2]) : null;
  const body = markdown.replace(TITLE_LINE, '').replace(STACK_LINE, '');
  return {
    id,
    title,
    summary: meta.summary ?? '',
    group: meta.group ?? 'work',
    cover,
    stack,
    html: renderMarkdown(body, resolvers),
  };
}

async function listNames(dir, filter) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return entries.filter(filter).map((entry) => entry.name).sort();
}

async function collectCases() {
  const projectsDir = join(ROOT, 'projects');
  const index = parseCaseIndex(await readFile(join(projectsDir, 'README.md'), 'utf8'));
  const ids = await listNames(projectsDir, (entry) => entry.isDirectory() && CASE_DIR.test(entry.name));
  return Promise.all(
    ids.map(async (id) => buildCase(id, await readFile(join(projectsDir, id, 'README.md'), 'utf8'), index.get(id), localImageSize)),
  );
}

async function main() {
  const cases = await collectCases();
  const target = join(ROOT, 'app', 'data.json');
  await writeFile(target, `${JSON.stringify({ cases }, null, 1)}\n`);
  process.stdout.write(`app/data.json: кейсов ${cases.length}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Сборка не удалась: ${error.message}\n`);
    process.exitCode = 1;
  });
}
