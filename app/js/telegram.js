// Обёртка над Telegram WebApp. В обычном браузере всё тихо отключается.

const TELEGRAM_SCRIPT_TIMEOUT_MS = 1500;
const START_PARAM_SEPARATOR = '__';

const webApp = () => window.Telegram?.WebApp;

// Скрипт Telegram создаёт объект WebApp и в обычном браузере — отличаем по платформе.
export const isInsideTelegram = () => Boolean(webApp()) && webApp().platform !== 'unknown';

function waitForScript() {
  if (webApp()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (webApp() || Date.now() - started > TELEGRAM_SCRIPT_TIMEOUT_MS) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

let connected = false;

function connect() {
  if (connected || !isInsideTelegram()) return { firstName: null, startRoute: null };
  connected = true;
  const app = webApp();
  app.ready();
  app.expand();
  try {
    app.setHeaderColor('secondary_bg_color');
    app.setBackgroundColor('secondary_bg_color');
  } catch (error) {
    console.warn('Telegram: не удалось задать цвета шапки', error);
  }
  document.documentElement.classList.add('in-telegram');
  const startParam = app.initDataUnsafe?.start_param;
  return {
    // Имя нужно только для приветствия; подпись initData не проверяется и ни на что не влияет.
    firstName: app.initDataUnsafe?.user?.first_name ?? null,
    // Ссылка вида t.me/бот/app?startapp=cases__03-product-analytics открывает нужный раздел.
    startRoute: startParam ? `/${startParam.split(START_PARAM_SEPARATOR).join('/')}` : null,
  };
}

export function setBackButton(visible, onBack) {
  if (!isInsideTelegram()) return;
  const button = webApp().BackButton;
  button.offClick(onBack);
  if (visible) {
    button.onClick(onBack);
    button.show();
  } else {
    button.hide();
  }
}

export function haptic() {
  if (isInsideTelegram()) webApp().HapticFeedback?.selectionChanged();
}

// Возвращает true, если ссылку открыл Telegram (и переход по умолчанию надо отменить).
export function openExternal(url) {
  if (!isInsideTelegram() || !/^https?:/i.test(url)) return false;
  if (/^https?:\/\/t\.me\//i.test(url)) webApp().openTelegramLink(url);
  else webApp().openLink(url);
  return true;
}

export async function initTelegram() {
  await waitForScript();
  return connect();
}

// Если скрипт Telegram не успел за отведённое время, подключаемся, когда он всё-таки загрузится.
export function whenTelegramLoadsLate(onConnect) {
  if (connected || webApp()) return;
  const script = document.querySelector('script[src*="telegram-web-app.js"]');
  script?.addEventListener('load', () => {
    if (isInsideTelegram()) onConnect(connect());
  });
}
