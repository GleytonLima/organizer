// Definições de tema: variáveis da interface + tema do xterm derivado delas.
import { ANSI } from './palette.js';

function defineTheme(id, name, kind, ui) {
  return {
    id,
    name,
    kind,
    ui,
    term: {
      ...ANSI[kind],
      background: ui.surface,
      foreground: ui.text,
      cursor: ui.accent,
      cursorAccent: ui.surface,
      selectionBackground: ui.accent + (kind === 'dark' ? '40' : '30'),
    },
  };
}

export const THEMES = [
  defineTheme('grafite', 'Grafite', 'dark', {
    app: '#101113', surface: '#16171a', raised: '#1e1f23', hover: '#25262b', border: '#27282d',
    text: '#e4e4e7', dim: '#9b9ca3', faint: '#5f6068', accent: '#d4d4d8', onAccent: '#111214',
  }),
  defineTheme('meia-noite', 'Meia-noite', 'dark', {
    app: '#0d1017', surface: '#121621', raised: '#191e2b', hover: '#202636', border: '#222838',
    text: '#e3e7f0', dim: '#94a0b8', faint: '#5a6478', accent: '#7aa2f7', onAccent: '#0d1017',
  }),
  defineTheme('ambar', 'Âmbar', 'dark', {
    app: '#12100e', surface: '#181512', raised: '#201c18', hover: '#28231e', border: '#2b2621',
    text: '#ece6de', dim: '#a59a8d', faint: '#6b6258', accent: '#d98a3d', onAccent: '#12100e',
  }),
  defineTheme('floresta', 'Floresta', 'dark', {
    app: '#0f1210', surface: '#141815', raised: '#1b201c', hover: '#222823', border: '#252b26',
    text: '#e2e8e3', dim: '#96a39a', faint: '#5d6860', accent: '#8fbf9a', onAccent: '#0f1210',
  }),
  defineTheme('claro', 'Claro', 'light', {
    app: '#f2f2f3', surface: '#ffffff', raised: '#f6f6f7', hover: '#e9e9ec', border: '#e2e2e6',
    text: '#1d1d20', dim: '#5f5f68', faint: '#9a9aa2', accent: '#2b2b30', onAccent: '#ffffff',
  }),
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
