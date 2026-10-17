// Diálogos com input real: clicar em qualquer campo (não só o 1º, que abre focado), contador e
// limite da decisão. Regressão: o fundo do modal cancelava o mousedown e travava os outros campos.
const { test, expect } = require('./fixtures');

test('Nova decisão: dá para clicar e digitar em todos os campos; limite de 280 com contador', async ({ page }) => {
  await page.getByTitle('Memória (decisões e notas)').click();
  await page.locator('#taskpanel').getByTitle('Nova decisão').click();
  const modal = page.locator('#modal');
  await expect(modal.getByRole('heading', { name: 'Nova decisão' })).toBeVisible();

  const text = modal.locator('[data-field="text"] input');
  await expect(text).toBeFocused();
  await page.keyboard.type('Usamos Postgres porque o time já domina.');

  const tags = modal.locator('[data-field="tags"] input');
  await tags.click();
  await expect(tags).toBeFocused();
  await page.keyboard.type('banco, infra');
  await expect(tags).toHaveValue('banco, infra');
  await expect(text).toHaveValue('Usamos Postgres porque o time já domina.');

  const links = modal.locator('.link-search input');
  await links.click();
  await expect(links).toBeFocused();

  await text.click();
  await text.fill('x'.repeat(281));
  const counter = modal.locator('[data-field="text"] .field-count');
  await expect(counter).toHaveText('281/280');
  await expect(counter).toHaveClass(/over/);
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(modal.locator('[data-field="text"]')).toHaveClass(/invalid/);
  await expect(page.locator('#modal-backdrop')).toBeVisible();

  await text.fill('Usamos Postgres porque o time já domina.');
  await expect(counter).toHaveText('40/280');
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('#modal-backdrop')).toBeHidden();
  await expect(page.locator('#taskpanel')).toContainText('Usamos Postgres porque o time já domina.');
});
