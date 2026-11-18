// Тесты готовых страниц: node --test tools/pages.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPages, buildSitemap, fillIndex, fillMarker, renderPage, staticLinks, trimDescription } from './pages.mjs';

const content = {
  profile: {
    name: 'Иван Иванов',
    initials: 'ИИ',
    role: 'Аналитик',
    location: 'Город',
    telegram: 'ivan',
    about: ['О себе'],
    philosophy: 'Мысль',
    stats: [],
    contacts: [{ label: 'Написать', href: 'https://t.me/ivan', primary: true }, { label: 'Почта', href: 'mailto:a@b.c' }],
    stack: [],
    credentials: [],
    recommendation: { quote: 'Хорошо', author: 'Кто-то' },
    featured: ['01-first'],
  },
  services: {
    lead: 'Делаю отчёты.',
    items: [{ id: 'analytics', icon: '📊', title: 'Аналитика и BI', lead: 'Отчёты на каждый день.', points: ['Дашборды', 'Метрики'], caseId: '01-first' }],
    site: { title: 'Сайт', text: 'Текст', label: 'site', href: 'https://example.com/' },
    process: [{ title: 'Заявка', note: 'Пишете' }],
  },
  bots: { lead: 'Мои боты.', items: [] },
  channel: { username: 'chan', title: 'Канал', text: 'Пишу' },
  bot: { username: 'leadbot' },
  caseFlows: {},
};
const cases = [
  { id: '01-first', title: 'Первый кейс', summary: 'Кратко', group: 'work', cover: 'assets/01.png', stack: ['SQL'], html: '<p>Текст <a href="#/cases/02-second">дальше</a></p><img src="assets/01.png" alt="">' },
  { id: '02-second', title: 'Второй <кейс>', summary: 'Ещё', group: 'pet', cover: null, stack: ['Node.js'], html: '<p>Текст</p>' },
];

test('ссылки приложения становятся обычными адресами от папки страницы', () => {
  const html = '<a href="#/">a</a><a href="#/cases">b</a><a href="#/cases?group=pet">c</a><a href="#/cases/01-first">d</a><a href="#/channel">e</a><a href="#/bots">f</a><img src="assets/x.png">';
  assert.equal(
    staticLinks(html, '../../', content),
    '<a href="../../">a</a><a href="../../cases/">b</a><a href="../../cases/">c</a><a href="../../cases/01-first/">d</a><a href="https://t.me/chan" target="_blank" rel="noopener">e</a><a href="../../#/bots">f</a><img src="../../assets/x.png">',
  );
  assert.equal(staticLinks('<a href="#/">a</a>', '', content), '<a href="./">a</a>');
});

test('описание обрезается по слову и не длиннее 160 знаков', () => {
  assert.equal(trimDescription('Коротко  и\nясно'), 'Коротко и ясно');
  const long = trimDescription('слово '.repeat(60));
  assert.equal(long.length <= 160, true);
  assert.equal(long.endsWith('слово…'), true);
});

test('набор страниц: услуги, каждая услуга, кейсы, каждый кейс; страницы ботов нет', () => {
  assert.deepEqual(
    buildPages(content, cases).map((page) => page.path),
    ['services/', 'services/analytics/', 'cases/', 'cases/01-first/', 'cases/02-second/'],
  );
});

test('страница услуги: заголовок, адрес, пример работы и ссылка на бота с темой', () => {
  const page = buildPages(content, cases).find((item) => item.path === 'services/analytics/');
  const html = renderPage(page, content, cases);
  assert.match(html, /<title>Аналитика и BI — Иван Иванов<\/title>/);
  assert.match(html, /<meta name="description" content="Отчёты на каждый день\. Дашборды; Метрики\.">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/m\.intstage\.ru\/services\/analytics\/">/);
  assert.match(html, /<h1>Аналитика и BI<\/h1>/);
  assert.match(html, /href="https:\/\/t\.me\/leadbot\?start=service_analytics"/);
  assert.match(html, /href="\.\.\/\.\.\/cases\/01-first\/"/);
  assert.match(html, /href="\.\.\/\.\.\/app\/styles\.css"/);
  assert.match(html, /"@type":"Service"/);
  assert.equal(html.includes('href="#/'), false);
  assert.equal(html.includes('src="assets/'), false);
});

test('страница кейса: один h1, обложка в превью, текст экранирован', () => {
  const pages = buildPages(content, cases);
  const first = renderPage(pages.find((item) => item.path === 'cases/01-first/'), content, cases);
  assert.equal(first.match(/<h1/g).length, 1);
  assert.match(first, /<meta property="og:image" content="https:\/\/m\.intstage\.ru\/assets\/01\.png">/);
  assert.match(first, /src="\.\.\/\.\.\/assets\/01\.png"/);
  const second = renderPage(pages.find((item) => item.path === 'cases/02-second/'), content, cases);
  assert.match(second, /<title>Второй &lt;кейс&gt; — кейс, Иван Иванов<\/title>/);
  assert.match(second, /og:image" content="https:\/\/m\.intstage\.ru\/assets\/brand\//);
});

test('карта сайта перечисляет главную и все страницы', () => {
  const sitemap = buildSitemap(buildPages(content, cases));
  assert.equal(sitemap.match(/<loc>/g).length, 6);
  assert.match(sitemap, /<loc>https:\/\/m\.intstage\.ru\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/m\.intstage\.ru\/cases\/02-second\/<\/loc>/);
});

test('главная вписывается между метками и не дублируется при повторной сборке', () => {
  const index = '<head>\n  <!-- seo:start -->\n  <!-- seo:end -->\n</head><main>\n    <!-- prerender:start -->\n    <!-- prerender:end -->\n</main>';
  const once = fillIndex(index, content, cases);
  assert.match(once, /<h1 class="hero__name">Иван Иванов<\/h1>/);
  assert.match(once, /"@type":"Person"/);
  assert.match(once, /href="cases\/01-first\/"/);
  assert.equal(once.includes('href="#/'), false);
  assert.equal(fillIndex(once, content, cases), once);
});

test('без меток в index.html сборка падает с понятной ошибкой', () => {
  assert.throws(() => fillMarker('<main></main>', 'prerender', 'x'), /нет меток prerender/);
});
