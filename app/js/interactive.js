// Живые элементы: проигрывание примеров диалогов и увеличение скриншотов.
// mount() вызывается после каждой отрисовки экрана и возвращает функцию очистки.

const MESSAGE_DELAY_MS = 900;
const VISIBLE_SHARE = 0.4;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playChat(figure) {
  const messages = [...figure.querySelectorAll('.chat__msg')];
  const replay = figure.querySelector('[data-chat-replay]');
  let timers = [];

  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const play = () => {
    stop();
    replay.hidden = true;
    figure.classList.add('is-playing');
    messages.forEach((message) => message.classList.remove('is-shown'));
    timers = messages.map((message, index) =>
      setTimeout(() => {
        message.classList.add('is-shown');
        if (index === messages.length - 1) replay.hidden = false;
      }, MESSAGE_DELAY_MS * (index + 0.4)),
    );
  };

  replay.addEventListener('click', play);
  return { play, stop };
}

function mountChats(root) {
  const figures = [...root.querySelectorAll('[data-chat]')];
  if (!figures.length || prefersReducedMotion() || !('IntersectionObserver' in window)) return () => {};
  const players = new Map(figures.map((figure) => [figure, playChat(figure)]));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        players.get(entry.target).play();
        observer.unobserve(entry.target);
      });
    },
    { threshold: VISIBLE_SHARE },
  );
  figures.forEach((figure) => observer.observe(figure));
  return () => {
    observer.disconnect();
    players.forEach((player) => player.stop());
  };
}

function createLightbox() {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML = `
    <button type="button" class="lightbox__close" aria-label="Закрыть">×</button>
    <div class="lightbox__scroll"><img alt=""></div>
    <p class="lightbox__hint">Нажмите на картинку, чтобы приблизить</p>`;
  const image = dialog.querySelector('img');
  dialog.addEventListener('click', (event) => {
    if (event.target === image) dialog.classList.toggle('is-zoomed');
    else dialog.close();
  });
  dialog.addEventListener('close', () => dialog.classList.remove('is-zoomed'));
  document.body.append(dialog);
  return {
    open(source) {
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      dialog.showModal();
    },
    close: () => dialog.open && dialog.close(),
  };
}

let lightbox = null;

function mountZoom(root) {
  const images = [...root.querySelectorAll('.prose img')];
  if (!images.length || typeof HTMLDialogElement === 'undefined') return () => {};
  lightbox ??= createLightbox();
  const open = (event) => lightbox.open(event.currentTarget);
  const onKey = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(event);
    }
  };
  images.forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Увеличить: ${image.alt || 'изображение'}`);
    image.addEventListener('click', open);
    image.addEventListener('keydown', onKey);
  });
  return () => lightbox.close();
}

export function mount(root) {
  const cleanups = [mountChats(root), mountZoom(root)];
  return () => cleanups.forEach((cleanup) => cleanup());
}
