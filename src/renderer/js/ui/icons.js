// Ícones de traço fino (16×16) usados na interface.
const PATHS = {
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  more: '<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>',
  close: '<path d="M4.75 4.75l6.5 6.5M11.25 4.75l-6.5 6.5"/>',
  chevron: '<path d="M5.5 6.5L8 9l2.5-2.5"/>',
  theme: '<circle cx="8" cy="8" r="5.25"/><path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor" stroke="none"/>',
  layoutLeft: '<rect x="2" y="3" width="12" height="10" rx="2.5"/><path d="M6.25 3v10"/>',
  layoutRight: '<rect x="2" y="3" width="12" height="10" rx="2.5"/><path d="M9.75 3v10"/>',
  layoutTabs: '<rect x="2" y="3" width="12" height="10" rx="2.5"/><path d="M2 6.5h12"/>',
  branch: '<circle cx="5" cy="4" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="11" cy="5.5" r="1.4"/><path d="M5 5.4v5.2M11 6.9c0 2.4-2.2 2.9-5.6 3.6"/>',
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  folder: '<path d="M2.25 4.75c0-.83.67-1.5 1.5-1.5h2.6l1.4 1.5h4.5c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5h-8.5c-.83 0-1.5-.67-1.5-1.5z"/>',
  terminal: '<path d="M3.5 5l3 3-3 3M8.5 11.5h4"/>',
  split: '<rect x="2" y="3" width="12" height="10" rx="2.5"/><path d="M8 3v10"/>',
  maximize: '<path d="M9.5 2.75h3.75v3.75M6.5 13.25H2.75V9.5M13.25 2.75L9 7M2.75 13.25L7 9"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return span;
}
