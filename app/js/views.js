// Экраны приложения. Каждая функция чистая: принимает данные, возвращает HTML-строку.
// HTML кейсов собран и экранирован на этапе сборки (tools/markdown.mjs).

import { button, caseCard, chat, chips, discussLink, esc, flow } from './components.js';

const GROUP_LABELS = { all: 'Все', work: 'Работа', pet: 'Пет-проекты' };

// Анимация отчёта: кадры проигрывает interactive.js на canvas. GIF и видео на части
// телефонов стоят на первом кадре (настройки автовоспроизведения), кадры от них не зависят.
function showcaseMedia(item) {
  if (!item.frames) {
    return `<img src="${esc(item.image)}" alt="" loading="lazy" width="${Number(item.width)}" height="${Number(item.height)}">`;
  }
  const durations = item.frameDurations.map(Number).join(',');
  return `<canvas data-frames="${esc(item.frames)}" data-durations="${durations}"
        width="${Number(item.frameWidth)}" height="${Number(item.frameHeight)}"></canvas>`;
}

function showcase(profile, cases) {
  const item = profile.showcase;
  const related = cases.find((entry) => entry.id === item?.caseId);
  if (!item || !related) return '';
  return `
    <section class="block showcase">
      <div class="showcase__text">
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.text)}</p>
        <a class="more" href="#/cases/${esc(related.id)}">Кейс: ${esc(related.title)}</a>
      </div>
      <div class="phone" aria-hidden="true">
        ${showcaseMedia(item)}
      </div>
    </section>`;
}

// Знак intstage: три ступени, последняя с точкой — буква «i». Цвета берутся из темы.
const BRAND_MARK = `<svg class="brand__mark" viewBox="20 16 56 64" aria-hidden="true">
  <rect x="24" y="57.5" width="12" height="18" rx="3" opacity="0.5"/>
  <rect x="42" y="47.5" width="12" height="28" rx="3" opacity="0.75"/>
  <rect x="60" y="39.5" width="12" height="36" rx="3"/>
  <circle class="brand__dot" cx="66" cy="27.5" r="7"/>
</svg>`;

export function viewHome({ content, cases, firstName }) {
  const { profile } = content;
  const featured = profile.featured.map((id) => cases.find((item) => item.id === id)).filter(Boolean);
  const stats = [...profile.stats, { value: String(cases.length), label: 'кейсов в портфолио' }];
  const [primary, ...secondary] = profile.contacts;
  return `
    <header class="hero">
      <span class="hero__mark" aria-hidden="true">${esc(profile.initials)}</span>
      ${profile.brand ? `<p class="brand">${BRAND_MARK}<span>${esc(profile.brand)}</span></p>` : ''}
      ${firstName ? `<p class="hero__hello">Привет, ${esc(firstName)}!</p>` : ''}
      <h1 class="hero__name">${esc(profile.name)}</h1>
      <p class="hero__role">${esc(profile.role)}</p>
      <p class="hero__place">${esc(profile.location)}</p>
      <div class="hero__actions">
        ${button(primary.label, primary.href, 'primary')}
        <div class="hero__links">${secondary.map((link) => button(link.label, link.href)).join('')}</div>
      </div>
    </header>

    <dl class="stats">
      ${stats.map((stat) => `<div><dt>${esc(stat.value)}</dt><dd>${esc(stat.label)}</dd></div>`).join('')}
    </dl>

    <section class="block">
      <h2>Обо мне</h2>
      ${profile.about.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
      <blockquote class="pull">${esc(profile.philosophy)}</blockquote>
    </section>

    ${showcase(profile, cases)}

    <section class="block">
      <div class="block__head"><h2>Избранные кейсы</h2><a href="#/cases">Все ${cases.length}</a></div>
      <div class="case-list">${featured.map((item) => caseCard(item, content.caseFlows)).join('')}</div>
    </section>

    <section class="block">
      <h2>Стек</h2>
      ${profile.stack.map((group) => `<h3 class="label">${esc(group.group)}</h3>${chips(group.items)}`).join('')}
    </section>

    <section class="block">
      <h2>Образование и статусы</h2>
      <ul class="facts">
        ${profile.credentials.map((item) => `<li><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></li>`).join('')}
      </ul>
      <figure class="quote">
        <blockquote>«${esc(profile.recommendation.quote)}»</blockquote>
        <figcaption>${esc(profile.recommendation.author)}</figcaption>
      </figure>
    </section>`;
}

export function viewCases({ content, cases, group }) {
  const active = GROUP_LABELS[group] ? group : 'all';
  const visible = active === 'all' ? cases : cases.filter((item) => item.group === active);
  const filters = Object.entries(GROUP_LABELS)
    .map(([key, label]) => {
      const href = key === 'all' ? '#/cases' : `#/cases?group=${key}`;
      const count = key === 'all' ? cases.length : cases.filter((item) => item.group === key).length;
      const current = key === active ? ' aria-current="true"' : '';
      return `<a href="${href}"${current}>${esc(label)} <small>${count}</small></a>`;
    })
    .join('');
  return `
    <header class="page-head">
      <h1>Кейсы</h1>
      <p>Рабочие проекты описаны обезличенно: без названий компаний, имён и клиентских данных.</p>
    </header>
    <nav class="segments" aria-label="Фильтр кейсов">${filters}</nav>
    <div class="case-list">${visible.map((item) => caseCard(item, content.caseFlows)).join('')}</div>`;
}

export function viewCase({ content, cases, item }) {
  const ask = discussLink(content, 'case', item.id, `Здравствуйте! Хочу обсудить задачу, похожую на кейс «${item.title}».`);
  const steps = content.caseFlows?.[item.id];
  const position = cases.indexOf(item);
  const next = cases[(position + 1) % cases.length];
  return `
    <article class="article">
      <p class="article__kicker">${item.group === 'pet' ? 'Пет-проект' : 'Рабочий кейс'} · ${position + 1} из ${cases.length}</p>
      <h1>${esc(item.title)}</h1>
      ${chips(item.stack)}
      ${steps ? flow(steps, 'Как это работает') : ''}
      <div class="prose">${item.html}</div>
      <footer class="article__cta">
        <p>Похожая задача?</p>
        ${button('Обсудить в Telegram', ask, 'primary')}
      </footer>
    </article>
    <a class="next-case" href="#/cases/${esc(next.id)}">
      <span>Следующий кейс</span>
      <strong>${esc(next.title)}</strong>
    </a>`;
}

function serviceCard(service, content, cases) {
  const related = cases.find((item) => item.id === service.caseId);
  const ask = discussLink(content, 'service', service.id, `Здравствуйте! Интересует услуга «${service.title}».`);
  return `
    <article class="service">
      <span class="service__icon" aria-hidden="true">${esc(service.icon)}</span>
      <h2>${esc(service.title)}</h2>
      <p class="service__lead">${esc(service.lead)}</p>
      <ul class="ticks">${service.points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>
      ${service.flow ? flow(service.flow, 'Как это работает') : ''}
      <div class="service__actions">
        ${button('Обсудить', ask, 'primary')}
        ${related ? `<a class="more" href="#/cases/${esc(related.id)}">Пример: ${esc(related.title)}</a>` : ''}
      </div>
    </article>`;
}

export function viewServices({ content, cases }) {
  const { services } = content;
  const leadDemo = content.bot?.username && services.leadDemo ? chat(services.leadDemo, 'Так выглядит заявка в боте') : '';
  return `
    <header class="page-head">
      <h1>Услуги</h1>
      <p>${esc(services.lead)}</p>
    </header>
    ${services.items.map((service) => serviceCard(service, content, cases)).join('')}
    <section class="block">
      <h2>Как проходит работа</h2>
      ${flow(services.process)}
      ${leadDemo}
    </section>
    <aside class="banner">
      <strong>${esc(services.site.title)}</strong>
      <p>${esc(services.site.text)}</p>
      ${button(services.site.label, services.site.href)}
    </aside>`;
}

function botCard(bot, cases) {
  const related = cases.find((item) => item.id === bot.caseId);
  return `
    <article class="bot">
      <header class="bot__head">
        <h2>${esc(bot.name)}</h2>
        <p class="bot__user">@${esc(bot.username)} <span class="badge">${esc(bot.access)}</span></p>
      </header>
      <p>${esc(bot.description)}</p>
      ${bot.demo ? chat(bot.demo, 'Пример диалога · данные условные') : ''}
      ${chips(bot.tags)}
      <div class="service__actions">
        ${button('Открыть бота', `https://t.me/${encodeURIComponent(bot.username)}`)}
        ${related ? `<a class="more" href="#/cases/${esc(related.id)}">Кейс: ${esc(related.title)}</a>` : ''}
      </div>
    </article>`;
}

export function viewBots({ content, cases }) {
  return `
    <header class="page-head">
      <h1>Боты</h1>
      <p>${esc(content.bots.lead)}</p>
    </header>
    ${content.bots.items.map((bot) => botCard(bot, cases)).join('')}`;
}

export function viewChannel({ content }) {
  const { channel } = content;
  return `
    <header class="page-head">
      <h1>${esc(channel.title)}</h1>
      <p>${esc(channel.text)}</p>
    </header>
    <aside class="banner banner--accent">
      <strong>@${esc(channel.username)}</strong>
      <p>Новые записи выходят в Telegram-канале — подписывайтесь, чтобы не пропустить.</p>
      ${button('Открыть канал', `https://t.me/${encodeURIComponent(channel.username)}`, 'primary')}
    </aside>`;
}

export function viewNotFound() {
  return `
    <header class="page-head">
      <h1>Страница не найдена</h1>
      <p>Такого раздела нет. <a href="#/">Вернуться на главную</a></p>
    </header>`;
}

export function viewError(message) {
  return `
    <header class="page-head">
      <h1>Не удалось загрузить визитку</h1>
      <p>${esc(message)}</p>
      <p><a href="">Попробовать ещё раз</a></p>
    </header>`;
}
