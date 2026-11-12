#!/usr/bin/env node
// Локальный просмотр мини-приложения: node tools/serve.mjs [порт]

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

async function resolveFile(urlPath) {
  const file = normalize(join(ROOT, decodeURIComponent(urlPath)));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return null;
  const info = await stat(file).catch(() => null);
  if (!info) return null;
  return info.isDirectory() ? resolveFile(join(urlPath, 'index.html')) : file;
}

const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    const file = await resolveFile(pathname);
    if (!file) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не найдено');
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Ошибка запроса: ${error.message}`);
  }
});

const port = Number(process.argv[2] ?? process.env.PORT ?? DEFAULT_PORT);
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Мини-приложение: http://127.0.0.1:${port}/\n`);
});
