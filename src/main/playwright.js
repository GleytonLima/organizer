// Testes Playwright dos projetos: a pasta tem playwright.config.*? E já existe relatório HTML?
// (O renderer roda os testes num terminal; ver src/renderer/js/playwright/.)
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIGS = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs', 'playwright.config.mts'];

/** { config, report } da pasta, ou null se ela não usa Playwright. */
function detectPlaywright(dir) {
  if (!dir) return null;
  const config = CONFIGS.find((f) => fs.existsSync(path.join(dir, f)));
  if (!config) return null;
  const report = path.join(dir, 'playwright-report', 'index.html');
  return { config, report: fs.existsSync(report) ? report : null };
}

function registerPlaywrightIpc() {
  ipcMain.handle('playwright:detect', (_e, dir) => detectPlaywright(dir));
}

module.exports = { registerPlaywrightIpc, detectPlaywright };
