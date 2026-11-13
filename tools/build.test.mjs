// Запуск: node --test tools/build.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCase, cleanTitle, makeResolvers, parseCaseIndex, readImageSize } from './build.mjs';
import { renderInline, renderMarkdown } from './markdown.mjs';

test('экранирует HTML в тексте и в коде', () => {
  assert.equal(renderInline('a <b> & `<i>`'), 'a &lt;b&gt; &amp; <code>&lt;i&gt;</code>');
});

test('рендерит жирный, курсив и ссылку с внешним открытием', () => {
  const html = renderInline('**важно** и *тихо*, [сайт](https://example.com)');
  assert.equal(
    html,
    '<strong>важно</strong> и <em>тихо</em>, <a href="https://example.com" target="_blank" rel="noopener">сайт</a>',
  );
});

test('заменяет небезопасную схему ссылки на #', () => {
  assert.match(renderInline('[x](javascript:alert(1))'), /href="#"/);
});

test('не трогает звёздочки внутри кода', () => {
  assert.equal(renderInline('`a * b * c`'), '<code>a * b * c</code>');
});

test('код в подписи ссылки остаётся кодом', () => {
  assert.equal(renderInline('[`src/`](src/)'), '<a href="src/"><code>src/</code></a>');
});

test('рендерит заголовок, цитату и список с вложенностью', () => {
  const html = renderMarkdown('## Задача\n\n> Цитата\n\n- один\n  - вложенный\n- два');
  assert.equal(
    html,
    '<h2>Задача</h2>\n<blockquote><p>Цитата</p></blockquote>\n<ul><li>один<ul><li>вложенный</li></ul></li><li>два</li></ul>',
  );
});

test('рендерит нумерованный список и блок кода', () => {
  assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  assert.equal(renderMarkdown('```js\nif (a < b) {}\n```'), '<pre><code>if (a &lt; b) {}</code></pre>');
});

test('рендерит таблицу', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | `2` |');
  assert.match(html, /<th>A<\/th><th>B<\/th>/);
  assert.match(html, /<td>1<\/td><td><code>2<\/code><\/td>/);
});

test('пропускает одиночный <img>, остальной HTML экранирует', () => {
  assert.match(renderMarkdown('<img src="a.gif" width="320" alt="демо">'), /<img src="a.gif" alt="демо" loading="lazy" style="max-width:min\(100%,320px\)">/);
  assert.equal(renderMarkdown('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('пути кейса приводятся к корню репозитория', () => {
  const { resolveSrc, resolveHref } = makeResolvers('projects/03-product-analytics');
  assert.equal(resolveSrc('../../assets/03-product.png'), 'assets/03-product.png');
  assert.equal(resolveHref('../01-lead-analytics/'), '#/cases/01-lead-analytics');
  assert.equal(resolveHref('src/crypto.1m.py'), 'https://github.com/intstage/portfolio/blob/main/projects/03-product-analytics/src/crypto.1m.py');
  assert.equal(resolveHref('https://example.com'), 'https://example.com');
});

test('индекс кейсов даёт описание и группу', () => {
  const index = parseCaseIndex(
    '| 01 | [Заявки](01-lead-analytics/) | CRM + Метрика |\n## Пет-проекты\n| 07 | [Бот](07-ton-trading-bot/) | Риск |',
  );
  assert.deepEqual(index.get('01-lead-analytics'), { summary: 'CRM + Метрика', group: 'work' });
  assert.deepEqual(index.get('07-ton-trading-bot'), { summary: 'Риск', group: 'pet' });
});

test('кейс: заголовок, стек и обложка вынимаются из текста', () => {
  const item = buildCase(
    '03-product-analytics',
    '# Продукт\n\n![Макет](../../assets/03-product.png)\n\n## Задача\nТекст\n\n**Стек:** `SQL` `Superset`\n',
    { summary: 'Загрузка', group: 'work' },
  );
  assert.equal(item.title, 'Продукт');
  assert.deepEqual(item.stack, ['SQL', 'Superset']);
  assert.equal(item.cover, 'assets/03-product.png');
  assert.doesNotMatch(item.html, /Стек:|<h1>/);
  assert.match(item.html, /src="assets\/03-product\.png"/);
});

test('размеры картинки читаются из заголовка и попадают в разметку', () => {
  const png = Buffer.alloc(24);
  png.write('\x89PNG', 0, 'latin1');
  png.writeUInt32BE(1680, 16);
  png.writeUInt32BE(1960, 20);
  assert.deepEqual(readImageSize(png), { width: 1680, height: 1960 });
  const gif = Buffer.from('GIF89a\x85\x02\x38\x04', 'latin1');
  assert.deepEqual(readImageSize(gif), { width: 645, height: 1080 });
  assert.equal(readImageSize(Buffer.from('не картинка')), null);
  const item = buildCase('01-x', '# T\n\n![a](../../assets/a.png)', {}, () => ({ width: 10, height: 20 }));
  assert.match(item.html, /<img src="assets\/a\.png" alt="a" loading="lazy" width="10" height="20">/);
});

test('из заголовка убирается приставка «Пет-проект»', () => {
  assert.equal(cleanTitle('Пет-проект: торговый бот для TON'), 'Торговый бот для TON');
  assert.equal(cleanTitle(' NPS и отзывы '), 'NPS и отзывы');
});
