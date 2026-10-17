// Fixture da suíte de interface: pasta de dados isolada com um state.json semeado, o app aberto pelo
// Playwright (_electron) e helpers para ler o estado do renderer.
//   test('...', async ({ page, electronApp, dir }) => { ... })
const { test: base, expect, _electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const seed = require('../lib/seed');

const ROOT = path.resolve(__dirname, '..', '..');

/** Estado inicial: um projeto com uma pasta e um terminal (o padrão das specs). */
function defaultState(dir) {
  const [app] = seed.makeFolders(dir, ['minha-app']);
  return seed.state([seed.project('p1', 'minha-app', [app], [seed.group('g1', 'Terminais', [seed.term('t1', 'dev', app)])])]);
}

const test = base.extend({
  // pasta temporária da spec (apagada no fim, a menos que falhe: fica para inspecionar)
  dir: async ({}, use, info) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bo-ui-'));
    await use(dir);
    if (info.status === info.expectedStatus) fs.rmSync(dir, { recursive: true, force: true });
  },
  // estado semeado: (dir) => state.json; uma spec troca com test.use({ seedState: async ({}, use) => use(fn) })
  seedState: async ({}, use) => use(defaultState),
  electronApp: async ({ dir, seedState }, use) => {
    const ud = path.join(dir, 'userdata');
    fs.mkdirSync(ud, { recursive: true });
    fs.writeFileSync(path.join(ud, 'state.json'), JSON.stringify(seedState(dir), null, 2));
    const app = await _electron.launch({ executablePath: require('electron'), args: [ROOT], env: { ...process.env, BO_USER_DATA: ud } });
    await use(app);
    await app.close();
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1400, height: 860 });
    await page.waitForFunction(async () => !!(await import('./js/core/store.js')).store.state?.projects);
    await use(page);
  },
});

/** Executa `fn(S)` no renderer, com S = módulo core/store.js. */
const inStore = (page, fn, arg) => page.evaluate(async ([src, a]) => (0, eval)(src)(await import('./js/core/store.js'), a), [fn.toString(), arg]);

/** Zoom da janela (processo principal). */
const zoomFactor = (electronApp) => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());

module.exports = { test, expect, inStore, zoomFactor };
