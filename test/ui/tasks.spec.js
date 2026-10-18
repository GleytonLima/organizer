// Tarefas com input real: criar pelo diálogo, arrastar entre colunas, gaveta (tags pelo teclado,
// cabeçalho fixo ao rolar) e o botão "Abrir quadro" visível no painel.
const { test, expect, inStore } = require('./fixtures');

async function newTask(page, title) {
  await page.locator('#taskpanel').getByTitle('Nova tarefa').click();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(page.locator('#taskpanel .task-title', { hasText: title })).toBeVisible();
}

test('criar, arrastar para outra coluna e editar tags na gaveta', async ({ page }) => {
  await page.getByTitle('Tarefas', { exact: true }).click();
  await newTask(page, 'Subir o backend');

  const card = page.locator('#taskpanel .task-card', { hasText: 'Subir o backend' });
  const doing = page.locator('#taskpanel .tp-section', { hasText: 'Fazendo' });
  await card.dragTo(doing.locator('.tp-head'));
  await expect(doing.locator('.task-card', { hasText: 'Subir o backend' })).toBeVisible();
  expect(await inStore(page, (S) => S.store.state.tasks[0].columnId === S.store.state.projects[0].taskColumns?.[1]?.id || S.store.state.tasks[0].history.some((h) => h.type === 'moved'))).toBe(true);

  await doing.locator('.task-card', { hasText: 'Subir o backend' }).click();
  const drawer = page.locator('#task-detail');
  const tagInput = drawer.locator('.td-tag-input');
  await tagInput.click();
  await page.keyboard.type('jira:PROJ-7');
  await page.keyboard.press('Enter');
  await expect(drawer.locator('.td-tag')).toHaveText(['#jira:PROJ-7']);
  await expect(page.locator('#taskpanel .task-chip.tag', { hasText: '#jira:PROJ-7' })).toBeVisible();

  // cabeçalho fixo: rolando até o fim, o fechar continua visível e funciona
  await drawer.evaluate((d) => (d.scrollTop = d.scrollHeight));
  const close = drawer.getByTitle('Fechar');
  await expect(close).toBeInViewport();
  await close.click();
  await expect(drawer).toBeHidden();
});

test('"Abrir quadro" cabe no painel e abre o kanban', async ({ page }) => {
  await page.getByTitle('Tarefas', { exact: true }).click();
  const open = page.locator('#taskpanel').getByTitle('Abrir quadro');
  await expect(open).toBeInViewport({ ratio: 1 });
  await open.click();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#board .kb-column')).toHaveCount(3);
});

test('o ícone de Insights abre o painel com os cinco cartões', async ({ page }) => {
  await page.getByTitle('Insights: fluxo, espera, custo e qualidade').click();
  await expect(page.locator('#board [data-card]')).toHaveCount(5);
  await expect(page.locator('#board [data-card="flow"]')).toContainText('Fluxo');
  await page.locator('#board').getByTitle('Voltar aos terminais').click();
  await expect(page.locator('#board')).toBeHidden();
});
