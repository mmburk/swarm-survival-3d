import { Engine } from './core/Engine';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    new Engine(container);
  }
});
