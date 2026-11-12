import { haptic, initTelegram, openExternal, setBackButton, whenTelegramLoadsLate } from './telegram.js';
import { esc } from './components.js';
import { mount } from './interactive.js';
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

const ICONS = {
  home: '<path d="M4 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/><circle cx="12" cy="7" r="4"/>',
  cases: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  services: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
  bots: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 13v2M15 13v2"/><circle cx="12" cy="3.5" r="1"/>',
  channel: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
};

const TABS = [
  { key: 'home', path: '/', label: 'Обо мне' },
  { key: 'cases', path: '/cases', label: 'Кейсы' },
  { key: 'services', path: '/services', label: 'Услуги' },
  { key: 'bots', path: '/bots', label: 'Боты' },
  { key: 'channel', path: '/channel', label: 'Канал' },
];

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');

async function loadJson(path) {
  const response = await fetch(path);
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
