// Zoom da interface: Ctrl + / Ctrl = (com ou sem Shift, e o + do teclado numérico) aumenta, Ctrl −
// diminui, Ctrl 0 volta a 100%; Ctrl + roda do mouse também. Em degraus, entre 67% e 200% — o menu
// padrão do Electron só reconhecia Ctrl+Shift+= para aumentar e deixava diminuir sem limite.
// O nível fica em window.json e é reaplicado ao abrir (fora dos limites, volta a 100%).
const { userFile, readJson, writeJsonAtomic } = require('./files');

const STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const FILE = () => userFile('window.json');

const clamp = (f) => (typeof f === 'number' && f >= STEPS[0] && f <= STEPS.at(-1) ? f : 1);

/** Próximo degrau acima (dir 1) ou abaixo (dir -1) do zoom atual. */
function step(current, dir) {
  if (dir > 0) return STEPS.find((s) => s > current + 0.001) ?? STEPS.at(-1);
  return [...STEPS].reverse().find((s) => s < current - 0.001) ?? STEPS[0];
}

function save(factor) {
  writeJsonAtomic(FILE(), { ...readJson(FILE(), {}), zoom: factor });
}

/** Tecla de zoom: 1 (aumentar), -1 (diminuir), 0 (100%) ou null. */
function zoomKey(input) {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null;
  if (['+', '=', 'Add'].includes(input.key) || input.code === 'NumpadAdd' || input.code === 'Equal') return 1;
  if (['-', '_', 'Subtract'].includes(input.key) || input.code === 'NumpadSubtract' || input.code === 'Minus') return -1;
  if (input.key === '0' || input.code === 'Numpad0' || input.code === 'Digit0') return 0;
  return null;
}

function attachZoom(win) {
  const wc = win.webContents;
  const apply = (factor) => {
    wc.setZoomFactor(factor);
    save(factor);
  };
  // reaplica a cada carga: o Chromium também lembra zoom por conta própria e pode trazer um nível antigo
  wc.on('did-finish-load', () => wc.setZoomFactor(clamp(readJson(FILE(), {}).zoom)));
  wc.on('before-input-event', (event, input) => {
    const dir = zoomKey(input);
    if (dir === null) return;
    event.preventDefault();
    apply(dir === 0 ? 1 : step(wc.getZoomFactor(), dir));
  });
  wc.on('zoom-changed', (_e, direction) => apply(step(wc.getZoomFactor(), direction === 'in' ? 1 : -1)));
}

module.exports = { attachZoom, zoomKey, step, clamp, STEPS };
