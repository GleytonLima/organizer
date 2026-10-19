// Check de "concluído" (círculo + v) que se desenha, como nos apps de banco ao terminar uma operação.
// Cor do acento do tema; o círculo se fecha, o v se desenha e dá um leve pulso (styles/check.css; sem
// animação se o sistema pedir menos movimento). `since`: quando a conclusão aconteceu — a tela pode
// re-renderizar no meio e a animação continua de onde estava (atraso negativo); depois, fica parado.
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 1100; // ms: círculo 500 + v (a partir de 420) 300 + pulso (a partir de 700) 320

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function doneCheck({ size = 30, since = Date.now() } = {}) {
  const elapsed = Date.now() - since;
  const draw = elapsed < DURATION;
  const svg = svgEl('svg', { viewBox: '0 0 28 28', width: size, height: size, class: `done-check${draw ? ' draw' : ''}`, 'aria-hidden': 'true' });
  const ring = svgEl('circle', { cx: 14, cy: 14, r: 12 });
  const mark = svgEl('path', { d: 'M8.6 14.4l3.7 3.7 7.2-7.8' });
  if (draw) {
    ring.style.animationDelay = `${-elapsed}ms`;
    mark.style.animationDelay = `${420 - elapsed}ms`;
    svg.style.animationDelay = `${700 - elapsed}ms`;
  }
  svg.append(ring, mark);
  return svg;
}
