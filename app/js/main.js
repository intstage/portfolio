import { haptic, initTelegram, openExternal, setBackButton, whenTelegramLoadsLate } from './telegram.js';
import { esc } from './components.js';
import { mount } from './interactive.js';
import { ICONS, TABS } from './nav.js';
import {
  viewBots,
  viewCase,
  viewCases,
  viewChannel,
  viewError,
  viewHome,
  viewNotFound,
  viewServices,
} from './views.js';

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');

async function loadJson(path) {
  // no-cache: браузер переспрашивает сервер, изменились ли данные (хостинг разрешает хранить их неделю).
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: ответ ${response.status}`);
  return response.json();
}

const ROUTE_PREFIX = '#/';

// Telegram открывает приложение с адресом вида #tgWebAppData=… — это не маршрут, а главная.
const hasRoute = () => location.hash.startsWith(ROUTE_PREFIX);

function parseRoute() {
  const [path, query = ''] = (hasRoute() ? location.hash.slice(1) : '/').split('?');
  const [section = '', id = null] = path.split('/').filter(Boolean);
  return { section, id, params: new URLSearchParams(query) };
}

function visibleTabs(content) {
  return TABS.filter((tab) => tab.key !== 'channel' || content.channel.username);
}

function renderTabs(content, section) {
  const activeKey = section || 'home';
  tabs.innerHTML = visibleTabs(content)
    .map((tab) => {
      const current = tab.key === activeKey ? ' aria-current="page"' : '';
      return `<a href="#${tab.path}"${current}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[tab.key]}</svg>
        <span>${esc(tab.label)}</span>
      </a>`;
    })
    .join('');
}

function renderRoute(state, route) {
  const { content, cases } = state;
  const { section, id, params } = route;
  if (!section) return viewHome(state);
  if (section === 'cases' && id) {
    const item = cases.find((entry) => entry.id === id);
    return item ? viewCase({ content, cases, item }) : viewNotFound();
  }
  if (id) return viewNotFound();
  if (section === 'cases') return viewCases({ content, cases, group: params.get('group') ?? 'all' });
  if (section === 'services') return viewServices(state);
  if (section === 'bots') return viewBots(state);
  if (section === 'channel' && content.channel.username) return viewChannel(state);
  return viewNotFound();
}

// При входе по прямой ссылке истории нет — тогда «назад» ведёт в родительский раздел.
function goBack() {
  if (history.length > 1) history.back();
  else location.hash = `#/${parseRoute().section}`;
}
let unmount = () => {};

function render(state) {
  const route = parseRoute();
  unmount();
  view.innerHTML = renderRoute(state, route);
  unmount = mount(view);
  const heading = view.querySelector('h1')?.textContent ?? '';
  const { name } = state.content.profile;
  document.title = route.section && heading ? `${heading} — ${name}` : `${name} — аналитик данных`;
  renderTabs(state.content, route.section);
  setBackButton(Boolean(route.id), goBack);
  view.classList.toggle('view--nested', Boolean(route.id));
  window.scrollTo(0, 0);
}

function handleClick(event) {
  const link = event.target.closest('a[href]');
  if (!link) return;
  haptic();
  // Переходы внутри приложения (#/…) обрабатывает роутер; Telegram открывает только внешние ссылки.
  if (link.getAttribute('href').startsWith('#')) return;
  if (openExternal(link.href)) event.preventDefault();
}

async function start() {
  try {
    const [content, data, telegram] = await Promise.all([
      loadJson('app/content.json'),
      loadJson('app/data.json'),
      initTelegram(),
    ]);
    let state = { content, cases: data.cases, firstName: telegram.firstName };
    if (telegram.startRoute && !hasRoute()) history.replaceState(null, '', `#${telegram.startRoute}`);
    document.addEventListener('click', handleClick);
    window.addEventListener('hashchange', () => render(state));
    render(state);
    // Скрипт Telegram мог загрузиться позже отведённого времени — тогда подключаемся к нему после.
    whenTelegramLoadsLate((late) => {
      state = { ...state, firstName: late.firstName };
      render(state);
    });
  } catch (error) {
    console.error('Визитка не загрузилась', error);
    view.innerHTML = viewError('Проверьте соединение и откройте визитку ещё раз.');
  }
}

start();
