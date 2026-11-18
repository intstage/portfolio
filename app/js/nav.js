// Вкладки и их значки: общие для приложения и для готовых страниц (tools/pages.mjs).

export const ICONS = {
  home: '<path d="M4 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/><circle cx="12" cy="7" r="4"/>',
  cases: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  services: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
  bots: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 13v2M15 13v2"/><circle cx="12" cy="3.5" r="1"/>',
  channel: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
};

export const TABS = [
  { key: 'home', path: '/', label: 'Обо мне' },
  { key: 'cases', path: '/cases', label: 'Кейсы' },
  { key: 'services', path: '/services', label: 'Услуги' },
  { key: 'bots', path: '/bots', label: 'Боты' },
  { key: 'channel', path: '/channel', label: 'Канал' },
];
