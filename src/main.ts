import { Engine } from './core/Engine';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (!container) return;

  // The listening bench instead of the game. Not linked from anywhere — the
  // whole point is that it costs nothing when it is not asked for.
  if (new URLSearchParams(window.location.search).get('audio') === 'test') {
    import('./ui/AudioTestPage').then((m) => m.mountAudioTestPage(container));
    return;
  }

  new Engine(container);
});
