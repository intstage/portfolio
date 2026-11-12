// Общие кирпичики экранов. Все функции чистые: данные → HTML-строка.
// Любое значение из content.json проходит через esc().

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const MAX_CARD_TAGS = 4;

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

export const chips = (items) => `<ul class="chips">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;

const isExternal = (href) => /^https?:/i.test(href);

export function button(label, href, variant = 'ghost') {
  const target = isExternal(href) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="button button--${variant}" href="${esc(href)}"${target}>${esc(label)}</a>`;
}

// Ссылка «обсудить»: если подключён бот заявок — открывает его с темой,
// иначе — личный чат с готовым текстом.
export function discussLink(content, kind, id, fallbackText) {
  const bot = content.bot?.username;
  if (bot) return `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(`${kind}_${id}`)}`;
  return `https://t.me/${encodeURIComponent(content.profile.telegram)}?text=${encodeURIComponent(fallbackText)}`;
}

// Вертикальная схема «как это работает» с бегущей подсветкой шагов.
export function flow(steps, caption) {
  const items = steps
    .map(
      (step, index) => `
      <li style="--i:${index}">
        <span class="flow__dot" aria-hidden="true">${index + 1}</span>
        <strong>${esc(step.title)}</strong>
        <span class="flow__note">${esc(step.note)}</span>
      </li>`,
    )
    .join('');
  return `
    <figure class="flow" style="--steps:${steps.length}">
      ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}
      <ol>${items}</ol>
    </figure>`;
}

// Компактная цепочка шагов в одну-две строки — для обложек карточек.
export function chain(steps) {
  return `<span class="chain" aria-hidden="true">${steps.map((step) => `<span>${esc(step.title)}</span>`).join('')}</span>`;
}

function chatMessage(message, index) {
  const buttons = message.buttons
    ? `<span class="chat__buttons">${message.buttons.map((label) => `<span>${esc(label)}</span>`).join('')}</span>`
    : '';
  const author = message.from === 'user' ? 'Вы' : 'Бот';
  const kind = message.from === 'user' ? 'user' : 'bot';
  // Одной строкой: внутри пузыря переносы строк значимы (white-space: pre-line).
  return `<li class="chat__msg chat__msg--${kind}" style="--i:${index}"><span class="visually-hidden">${author}: </span>${esc(message.text)}${buttons}</li>`;
}

// Пример диалога с ботом: сообщения появляются по очереди, когда блок попадает на экран.
export function chat(messages, caption = 'Пример диалога') {
  return `
    <figure class="chat" data-chat>
      <figcaption>
        <span>${esc(caption)}</span>
        <button type="button" class="chat__replay" data-chat-replay hidden>Повторить</button>
      </figcaption>
      <ol class="chat__log">${messages.map(chatMessage).join('')}</ol>
    </figure>`;
}

export function caseCard(item, caseFlows = {}) {
  const steps = caseFlows[item.id];
  let cover = `<span class="case-card__cover case-card__cover--empty" aria-hidden="true">${esc(item.id.slice(0, 2))}</span>`;
  if (item.cover) cover = `<img class="case-card__cover" src="${esc(item.cover)}" alt="" loading="lazy" width="16" height="9">`;
  else if (steps) cover = `<span class="case-card__cover case-card__cover--chain">${chain(steps)}</span>`;
  return `
    <a class="case-card" href="#/cases/${esc(item.id)}">
      ${cover}
      <span class="case-card__body">
        <strong class="case-card__title">${esc(item.title)}</strong>
        <span class="case-card__summary">${esc(item.summary)}</span>
        ${chips(item.stack.slice(0, MAX_CARD_TAGS))}
      </span>
    </a>`;
}
