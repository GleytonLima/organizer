// Teclado real num terminal de verdade (Git Bash pelo pty).
// O zoom (Ctrl + / −) fica na suíte shell do harness: teclas injetadas pelo Playwright (CDP) não passam
// pelo before-input-event do Electron, onde o zoom é tratado.
const { test, expect } = require('./fixtures');

test('digitar no terminal roda o comando no Git Bash', async ({ page }) => {
  const term = page.locator('.term-host').first();
  await expect(term.locator('.xterm')).toBeVisible();
  await term.locator('.xterm-screen').click();
  await expect.poll(() => term.locator('.xterm-rows').innerText(), { timeout: 20000 }).toMatch(/\$\s*$/m);
  await page.keyboard.type('echo ola-playwright');
  await page.keyboard.press('Enter');
  await expect.poll(() => term.locator('.xterm-rows').innerText(), { timeout: 15000 }).toMatch(/^ola-playwright\s*$/m);
});
