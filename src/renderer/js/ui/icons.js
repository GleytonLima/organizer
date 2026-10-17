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
  kanban: '<rect x="2" y="2.75" width="12" height="10.5" rx="2.5"/><path d="M5.5 5.5v4M8 5.5v2M10.5 5.5v5.5"/>',
  pause: '<circle cx="8" cy="8" r="5.5"/><path d="M6.75 6v4M9.25 6v4"/>',
  settings: '<path d="M3 5h6M11.5 5H13M3 11h1.5M7 11h6"/><circle cx="10.25" cy="5" r="1.25"/><circle cx="5.75" cy="11" r="1.25"/>',
  trash: '<path d="M3.25 4.5h9.5M6.5 4.5V3.25h3V4.5M4.5 4.5l.6 8.1c.05.65.6 1.15 1.25 1.15h3.3c.65 0 1.2-.5 1.25-1.15l.6-8.1"/>',
  send: '<path d="M2.75 8h9M8.5 4.25L12.25 8 8.5 11.75"/>',
  collapse: '<path d="M2.75 9.5h3.75v3.75M13.25 6.5H9.5V2.75M6.5 9.5L2.5 13.5M9.5 6.5l4-4"/>',
  bell: '<path d="M4.25 11.25V7.5a3.75 3.75 0 0 1 7.5 0v3.75l1 1.25H3.25zM6.75 13.5a1.4 1.4 0 0 0 2.5 0"/>',
  split: '<rect x="2" y="3" width="12" height="10" rx="2.5"/><path d="M8 3v10"/>',
  maximize: '<path d="M9.5 2.75h3.75v3.75M6.5 13.25H2.75V9.5M13.25 2.75L9 7M2.75 13.25L7 9"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return span;
}
