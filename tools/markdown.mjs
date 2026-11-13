// Небольшой рендер Markdown → HTML без зависимостей.
// Покрывает то, что встречается в кейсах и записях блога: заголовки, абзацы,
// цитаты, списки (с одним уровнем вложенности), таблицы, код, картинки, ссылки.
// Весь текст экранируется; из сырого HTML пропускается только одиночный <img>.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const SAFE_URL = /^(https?:|mailto:|tel:|#|[^:]*$)/i;
const INLINE_TOKEN = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/g;
const PLACEHOLDER = /\u0000(\d+)\u0000/g;

const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const QUOTE = /^>\s?/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;
const HTML_IMAGE = /^<img\s+([^>]*?)\/?>$/i;
const NESTED_INDENT = 2;

const defaultResolvers = {
  resolveSrc: (src) => src,
  resolveHref: (href) => href,
  // Размеры картинки (чтобы страница не прыгала при загрузке); null — неизвестны.
  imageSize: () => null,
};

export const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

const safeUrl = (url) => (SAFE_URL.test(url) ? url : '#');

function imageTag(src, alt, width, ctx) {
  const widthAttr = /^\d+$/.test(width ?? '') ? ` style="max-width:min(100%,${width}px)"` : '';
  const url = safeUrl(ctx.resolveSrc(src));
  const size = ctx.imageSize(url);
  const sizeAttrs = size ? ` width="${size.width}" height="${size.height}"` : '';
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt ?? '')}" loading="lazy"${sizeAttrs}${widthAttr}>`;
}

function linkTag(label, href, ctx) {
  const url = safeUrl(ctx.resolveHref(href));
  const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${escapeHtml(url)}"${external}>${renderInline(label, ctx)}</a>`;
}

export function renderInline(text, resolvers = defaultResolvers) {
  const ctx = { ...defaultResolvers, ...resolvers };
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  // Один проход: что встретилось левее, то и выигрывает — код защищает своё содержимое,
  // а код внутри подписи ссылки обрабатывается рекурсивно.
  const withTokens = text.replace(INLINE_TOKEN, (_, code, alt, src, label, href) => {
    if (code !== undefined) return keep(`<code>${escapeHtml(code)}</code>`);
    if (src !== undefined) return keep(imageTag(src, alt, null, ctx));
    return keep(linkTag(label, href, ctx));
  });

  return escapeHtml(withTokens)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(PLACEHOLDER, (_, index) => stash[Number(index)]);
}

function readFence(lines, start) {
  if (!FENCE.test(lines[start])) return null;
  let end = start + 1;
  while (end < lines.length && !FENCE.test(lines[end])) end += 1;
  const code = lines.slice(start + 1, end).join('\n');
  return { html: `<pre><code>${escapeHtml(code)}</code></pre>`, next: end + 1 };
}

function readHeading(lines, start, ctx) {
  const match = HEADING.exec(lines[start]);
  if (!match) return null;
  const level = match[1].length;
  return { html: `<h${level}>${renderInline(match[2], ctx)}</h${level}>`, next: start + 1 };
}

function readRule(lines, start) {
  return RULE.test(lines[start].trim()) ? { html: '<hr>', next: start + 1 } : null;
}

function readQuote(lines, start, ctx) {
  if (!QUOTE.test(lines[start])) return null;
  let end = start;
  while (end < lines.length && QUOTE.test(lines[end])) end += 1;
  const inner = lines.slice(start, end).map((line) => line.replace(QUOTE, '')).join('\n');
  return { html: `<blockquote>${renderMarkdown(inner, ctx)}</blockquote>`, next: end };
}

function readHtmlImage(lines, start, ctx) {
  const match = HTML_IMAGE.exec(lines[start].trim());
  if (!match) return null;
  const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  if (!attrs.src) return null;
  return { html: `<p>${imageTag(attrs.src, attrs.alt, attrs.width, ctx)}</p>`, next: start + 1 };
}

function readList(lines, start, ctx) {
  const first = LIST_ITEM.exec(lines[start]);
  if (!first || first[1].length >= NESTED_INDENT) return null;
  const tag = /\d/.test(first[2]) ? 'ol' : 'ul';
  const items = [];
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const match = LIST_ITEM.exec(line);
    if (match && match[1].length < NESTED_INDENT) {
      items.push({ text: [match[3]], nested: [] });
    } else if (match) {
      items.at(-1).nested.push(line.slice(NESTED_INDENT));
    } else if (line.trim() && /^\s/.test(line)) {
      items.at(-1).text.push(line.trim());
    } else {
      break;
    }
  }
  const body = items
    .map(({ text, nested }) => {
      const nestedHtml = nested.length ? renderMarkdown(nested.join('\n'), ctx) : '';
      return `<li>${renderInline(text.join(' '), ctx)}${nestedHtml}</li>`;
    })
    .join('');
  return { html: `<${tag}>${body}</${tag}>`, next: index };
}

const splitRow = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

function readTable(lines, start, ctx) {
  const divider = lines[start + 1];
  if (!TABLE_ROW.test(lines[start]) || divider === undefined || !TABLE_DIVIDER.test(divider)) return null;
  let end = start + 2;
  while (end < lines.length && TABLE_ROW.test(lines[end])) end += 1;
  const cells = (row, tag) => splitRow(row).map((cell) => `<${tag}>${renderInline(cell, ctx)}</${tag}>`).join('');
  const head = `<thead><tr>${cells(lines[start], 'th')}</tr></thead>`;
  const rows = lines.slice(start + 2, end).map((row) => `<tr>${cells(row, 'td')}</tr>`).join('');
  return { html: `<div class="table-wrap"><table>${head}<tbody>${rows}</tbody></table></div>`, next: end };
}

const BLOCK_READERS = [readFence, readHeading, readRule, readQuote, readHtmlImage, readList, readTable];

function readBlock(lines, start, ctx) {
  for (const reader of BLOCK_READERS) {
    const block = reader(lines, start, ctx);
    if (block) return block;
  }
  return null;
}

function readParagraph(lines, start, ctx) {
  let end = start + 1;
  while (end < lines.length && lines[end].trim() && !readBlock(lines, end, ctx)) end += 1;
  const text = lines.slice(start, end).map((line) => line.trim()).join('\n');
  return { html: `<p>${renderInline(text, ctx)}</p>`, next: end };
}

export function renderMarkdown(source, resolvers = defaultResolvers) {
  const ctx = { ...defaultResolvers, ...resolvers };
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const block = readBlock(lines, index, ctx) ?? readParagraph(lines, index, ctx);
    html.push(block.html);
    index = block.next;
  }
  return html.join('\n');
}
