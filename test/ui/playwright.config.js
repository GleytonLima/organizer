// Suíte de interface com Playwright: abre o app de verdade (Electron do projeto) e usa cliques,
// teclado e arrastar REAIS — o que o harness de test/run.js (eventos sintéticos) não pega.
// Rodar: npm run test:ui   (relatório/trace em test/ui/results quando algo falha)
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  outputDir: `${__dirname}/results`,
  timeout: 60000,
  workers: 1, // uma janela por vez: o app é pesado e usa pty
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
