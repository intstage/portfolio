// Готовые страницы для поиска: те же экраны, что в приложении, но обычными HTML-файлами
// (services/, cases/), плюс главная, вписанная в index.html, sitemap.xml и robots.txt.
// Функции чистые: данные → строки. Файлы пишет tools/build.mjs.

import { button, caseCard, discussLink, esc, flow } from '../app/js/components.js';
import { ICONS, TABS } from '../app/js/nav.js';
import { viewCase, viewHome, viewServices } from '../app/js/views.js';

export const SITE_URL = 'https://m.intstage.ru';
// Папки, которые сборка пересоздаёт. Страницы «Боты» нет намеренно: имена личных ботов
// не проходят проверку на личные данные перед отправкой; вкладка ведёт в приложение.
export const GENERATED_DIRS = ['services', 'cases', 'bots'];
const STATIC_SECTIONS = ['services', 'cases'];
const SHARE_IMAGE = 'assets/brand/bot-description-640x360.png';
const DESCRIPTION_LIMIT = 160;
const GROUP_TITLES = { work: 'Рабочие кейсы', pet: 'Пет-проекты' };

const prefixFor = (path) => '../'.repeat(path.split('/').filter(Boolean).length);

// «#/cases/01-x» из приложения → обычный адрес; пути картинок — от папки страницы.
export function staticLinks(html, prefix, content) {
  const channel = `https://t.me/${encodeURIComponent(content.channel?.username ?? '')}`;
  return html
    .replace(/href="#\/([a-z]*)(?:\/([^"?]+))?(?:\?[^"]*)?"/g, (_, section, id) => {
      if (!section) return `href="${prefix || './'}"`;
      if (section === 'channel') return `href="${channel}" target="_blank" rel="noopener"`;
      if (!STATIC_SECTIONS.includes(section)) return `href="${prefix || './'}#/${section}"`;
      return `href="${prefix}${section}/${id ? `${id}/` : ''}"`;
    })
    .replace(/(src|data-frames)="assets\//g, `$1="${prefix}assets/`);
}

export function trimDescription(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;
  return `${clean.slice(0, DESCRIPTION_LIMIT - 1).replace(/\s+\S*$/, '')}…`;
}

const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function personLd(content) {
  const { profile } = content;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.role,
    url: `${SITE_URL}/`,
    sameAs: profile.contacts.map((link) => link.href).filter((href) => /^https?:/.test(href)),
  };
}

// Общие теги для поиска и превью ссылок.
export function seoTags({ title, description, path, image = SHARE_IMAGE, ld }) {
  const url = `${SITE_URL}/${path}`;
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(`${SITE_URL}/${image}`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    ld ? jsonLd(ld) : '',
  ]
    .filter(Boolean)
    .join('\n  ');
}

function tabsNav(content, activeKey, prefix) {
  const links = TABS.filter((tab) => tab.key !== 'channel' || content.channel?.username)
    .map((tab) => {
      const current = tab.key === activeKey ? ' aria-current="page"' : '';
      return `<a href="#${tab.path}"${current}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[tab.key]}</svg><span>${esc(tab.label)}</span></a>`;
    })
    .join('');
  return staticLinks(links, prefix, content);
}

// Перечень всех страниц: по нему поисковик и человек доходят до любой услуги и кейса.
function siteLinks(content, cases, prefix) {
  const list = (items) => `<ul>${items.map(([href, label]) => `<li><a href="${prefix}${href}">${esc(label)}</a></li>`).join('')}</ul>`;
  return `
    <nav class="sitelinks" aria-label="Все страницы">
      <h2>Услуги</h2>
      ${list(content.services.items.map((service) => [`services/${service.id}/`, service.title]))}
      <h2>Кейсы</h2>
      ${list(cases.map((item) => [`cases/${item.id}/`, item.title]))}
    </nav>`;
}

export function renderPage(page, content, cases) {
  const prefix = prefixFor(page.path);
  const body = staticLinks(page.body, prefix, content);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  ${seoTags(page)}
  <link rel="icon" href="${prefix}assets/brand/favicon-mark.png" type="image/png">
  <link rel="apple-touch-icon" href="${prefix}assets/brand/apple-touch-icon.png">
  <link rel="stylesheet" href="${prefix}app/styles.css">
</head>
<body>
  <main id="view" class="view">
    ${body}
    ${siteLinks(content, cases, prefix)}
  </main>
  <nav id="tabs" class="tabs" aria-label="Разделы">${tabsNav(content, page.tab, prefix)}</nav>
  <script type="module">
    import { mount } from '${prefix}app/js/interactive.js';
    mount(document.getElementById('view'));
  </script>
</body>
</html>
`;
}

function servicePage(service, content, cases) {
  const { profile, services } = content;
  const related = cases.find((item) => item.id === service.caseId);
  const ask = discussLink(content, 'service', service.id, `Здравствуйте! Интересует услуга «${service.title}».`);
  const body = `
    <header class="page-head">
      <p><a href="#/services">Услуги</a></p>
      <h1>${esc(service.title)}</h1>
      <p>${esc(service.lead)}</p>
    </header>
    <article class="service">
      <h2>Что делаю</h2>
      <ul class="ticks">${service.points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>
      ${service.flow ? flow(service.flow, 'Как это работает') : ''}
      <div class="service__actions">${button('Обсудить задачу в Telegram', ask, 'primary')}</div>
    </article>
    ${related ? `<section class="block"><h2>Пример работы</h2><div class="case-list">${caseCard(related, content.caseFlows)}</div></section>` : ''}
    <section class="block">
      <h2>Как проходит работа</h2>
      ${flow(services.process)}
    </section>`;
  return {
    path: `services/${service.id}/`,
    tab: 'services',
    title: `${service.title} — ${profile.name}`,
    description: trimDescription(`${service.lead} ${service.points.join('; ')}.`),
    ld: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.title,
      description: service.lead,
      url: `${SITE_URL}/services/${service.id}/`,
      provider: { '@type': 'Person', name: profile.name, url: `${SITE_URL}/` },
    },
    body,
  };
}

function casesPage(content, cases) {
  const groups = Object.entries(GROUP_TITLES)
    .map(([group, title]) => {
      const items = cases.filter((item) => item.group === group);
      if (!items.length) return '';
      return `<h2>${esc(title)}</h2><div class="case-list">${items.map((item) => caseCard(item, content.caseFlows)).join('')}</div>`;
    })
    .join('');
  return {
    path: 'cases/',
    tab: 'cases',
    title: `Кейсы по аналитике данных и автоматизации — ${content.profile.name}`,
    description: trimDescription(
      `${cases.length} кейсов: ${cases.slice(0, 4).map((item) => item.title).join(', ')} и другие. Рабочие проекты описаны обезличенно.`,
    ),
    body: `
    <header class="page-head">
      <h1>Кейсы</h1>
      <p>Рабочие проекты описаны обезличенно: без названий компаний, имён и клиентских данных.</p>
    </header>
    ${groups}`,
  };
}

function casePage(item, content, cases) {
  return {
    path: `cases/${item.id}/`,
    tab: 'cases',
    title: `${item.title} — кейс, ${content.profile.name}`,
    description: trimDescription(`${item.summary}. Стек: ${item.stack.join(', ')}.`),
    image: item.cover ?? undefined,
    body: viewCase({ content, cases, item }),
  };
}

// Все отдельные страницы сайта (без главной — она вписывается в index.html).
export function buildPages(content, cases) {
  const { profile, services } = content;
  return [
    {
      path: 'services/',
      tab: 'services',
      title: `Услуги: ${services.items.map((service) => service.title.toLowerCase()).join(', ')} — ${profile.name}`,
      description: trimDescription(services.lead),
      body: viewServices({ content, cases }),
    },
    ...services.items.map((service) => servicePage(service, content, cases)),
    casesPage(content, cases),
    ...cases.map((item) => casePage(item, content, cases)),
  ];
}

export function buildSitemap(pages) {
  const urls = ['', ...pages.map((page) => page.path)].map((path) => `  <url><loc>${SITE_URL}/${path}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

// Заменяет текст между метками <!-- name:start --> и <!-- name:end -->; без меток — ошибка.
export function fillMarker(html, name, inner) {
  const pattern = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!pattern.test(html)) throw new Error(`В index.html нет меток ${name}:start / ${name}:end`);
  return html.replace(pattern, (_, start, end) => `${start}\n${inner}\n    ${end}`);
}

// Главная: теги для поиска в <head> и готовый первый экран внутри <main>.
export function fillIndex(html, content, cases) {
  const { profile } = content;
  const tags = seoTags({
    title: `${profile.name} — аналитик данных`,
    description: `${profile.name} — ${profile.role}: кейсы, услуги, боты и контакты.`,
    path: '',
    ld: personLd(content),
  });
  const home = staticLinks(viewHome({ content, cases, firstName: null }), '', content);
  return fillMarker(fillMarker(html, 'seo', `  ${tags}`), 'prerender', `    <div class="prerender">${home}</div>`);
}
