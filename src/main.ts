import './style.css';
import { App } from './app';

const root = document.getElementById('app')!;
try {
  const app = new App(root);
  if (import.meta.env.DEV) Object.assign(window, { app, THREE: await import('three') });
} catch (err) {
  console.error(err);
  root.innerHTML = `<div class="fatal"><h1>Couldn't start the simulator</h1><p>This tool needs WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari.</p><pre>${String(err)}</pre></div>`;
}
