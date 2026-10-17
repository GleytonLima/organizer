// Vínculos entre memórias, cadeia de impacto, "a revisar", tipos ideia/como fazer, ideia que vira
// tarefa, memórias da tarefa (contexto do agente) e o período da lista de tarefas.
const path = require('path');
const { suite, seed } = require('./harness');

suite('memória: vínculos, impacto, tipos e tarefas', {
  seed: (dir) => {
    const [repo] = seed.makeFolders(path.join(dir, 'repos'), ['app']);
    return seed.state([seed.project('pA', 'App', [repo], [seed.group('gA', 'Terminais', [seed.term('a1', 'a1', repo)])])]);
  },
}, async (t) => {
  const a = await t.mcp('a1');
  const shot = async (name) => process.env.BO_TEST_SHOTS && require('fs').writeFileSync(path.join(process.env.BO_TEST_SHOTS, `links-${name}.png`), (await t.wc.capturePage()).toPNG());
  const data = async (tool, args) => {
    const r = await a.tool(tool, args);
    if (!r.ok) throw new Error(`${tool}: ${JSON.stringify(r)}`);
    return r.data;
  };

  // cadeia: base ← filas (depends) ← workers (depends); eventos (related); síncrono (contradicts)
  const base = await data('record_decision', { text: 'O processamento é assíncrono porque o volume tem picos.' });
  const filas = await data('record_decision', { text: 'Usamos filas porque o processamento é assíncrono.', links: [{ id: base.id, type: 'depends' }] });
  const workers = await data('remember_note', { text: 'Workers escalam pelo tamanho da fila.', links: [{ id: filas.id }] });
  await data('remember_note', { text: 'Eventos de domínio saem pela mesma fila.', links: [{ id: base.id, type: 'related' }] });
  await data('record_decision', { text: 'Processar tudo síncrono foi descartado porque trava nos picos.', links: [{ id: base.id, type: 'contradicts' }] });
  t.equal(filas.refs?.[0]?.type, 'depends', 'record_decision grava vínculos (tipo depends)');

  const links = await data('memory_links', { id: base.id });
  t.equal(links.incoming.map((l) => l.type).sort(), ['contradicts', 'depends', 'related'], 'memory_links mostra os vínculos de entrada com o tipo');
  t.equal(links.impact.map((l) => [l.memory.id, l.depth]), [[filas.id, 1], [workers.id, 2]], 'cadeia de impacto segue só "depends", com a distância');
  t.includes((await t.bo(['mem', 'links', base.id], { terminal: 'a1' })).stdout, 'Cadeia de impacto', 'bo mem links mostra a cadeia');

  // evoluir: update_memory devolve o impacto; marcar e revisar
  const updated = await data('update_memory', { id: base.id, text: 'O processamento é assíncrono porque o volume tem picos e há SLAs longos.' });
  t.equal(updated.impact.length, 2, 'update_memory devolve a cadeia de impacto');
  await data('mark_for_review', { ids: [filas.id, workers.id], reason: 'Mudou: SLAs longos', source: base.id });
  const pending = (await data('search_memory', { query: '', needsReview: true })).items.map((m) => m.id).sort();
  t.equal(pending, [filas.id, workers.id].sort(), 'search_memory com needsReview lista as marcadas');
  t.includes((await t.bo(['mem', 'review'], { terminal: 'a1' })).stdout, '[a revisar]', 'bo mem review lista as marcadas');
  await data('mark_reviewed', { id: workers.id });
  t.equal((await data('search_memory', { query: '', needsReview: true })).items.map((m) => m.id), [filas.id], 'mark_reviewed tira a marca');

  // UI: editar a base pela interface oferece a cadeia e marca a escolhida
  await t.js(`S.store.state.sideTab = 'memory'; S.store.state.taskView = 'panel'; S.commit();`);
  await t.js(`const m = await api.memory.get(${JSON.stringify(base.id)}); D.editMemoryDialog(S.projectById('pA'), m);`, { D: './js/ui/memory/dialogs.js' });
  await t.waitFor(() => t.modal.open());
  await t.js(`const ta = document.querySelector('#modal textarea, #modal input.input'); ta.value = 'O processamento é assíncrono por causa dos picos.'; ta.dispatchEvent(new Event('input'));`);
  await t.modal.submit();
  const chain = await t.waitFor(async () => (await t.modal.open()) && /Cadeia de impacto/.test(await t.modal.text()) && t.modal.text());
  t.check(chain && chain.includes('Usamos filas') && chain.includes('Workers escalam'), 'editar pela interface mostra a cadeia de impacto', chain);
  await shot('cadeia');
  await t.modal.submit(); // marca o 1º nível (filas) — já marcada, continua; workers (2º nível) não
  await t.waitFor(async () => !(await t.modal.open()));
  const flagged = await t.waitFor(async () => /a revisar/.test(await t.js(`return document.querySelector('#taskpanel').innerText`)));
  t.check(flagged, 'aba Memória mostra a marca "a revisar"');
  await t.js(`const m = await api.memory.get(${JSON.stringify(filas.id)}); D.editMemoryDialog(S.projectById('pA'), m);`, { D: './js/ui/memory/dialogs.js' });
  await t.waitFor(async () => /apoia-se em/.test(await t.modal.text()));
  await t.js(`document.querySelector('.links-field input.input').focus()`);
  await t.wait(600);
  await shot('vinculos');
  await t.modal.cancel();
  await t.waitFor(async () => !(await t.modal.open()));

  // tipos novos
  const idea = await data('remember_note', { kind: 'idea', text: 'Exportar a memória em markdown\nPara colar em PRs.' });
  const how = await data('remember_note', { kind: 'howto', text: 'Deploy travado: limpar o cache do runner e reexecutar.' });
  t.equal([idea.kind, idea.status, how.kind], ['idea', 'open', 'howto'], 'ideia (aberta) e "como fazer" são gravadas');
  const converted = await data('idea_to_task', { id: idea.id });
  t.equal(converted.title, 'Exportar a memória em markdown', 'ideia vira tarefa com a 1ª linha como título');
  const all = (await data('search_memory', { query: '' })).items.map((m) => m.id);
  const ideas = (await data('search_memory', { query: '', kind: 'idea' })).items;
  t.check(!all.includes(idea.id) && ideas.some((m) => m.id === idea.id && m.status === 'converted'), 'ideia convertida sai do "tudo" e fica no filtro de ideias');

  // memórias da tarefa: a ideia já vem vinculada; vincular o "como fazer" e ler pelo get_task
  await data('link_task_memory', { task: converted.key, memory: [how.id] });
  const task = await data('get_task', { task: converted.key });
  t.equal(task.memories.map((m) => m.kind).sort(), ['howto', 'idea'], 'get_task traz as memórias vinculadas (contexto do agente)');
  t.includes((await t.bo(['task', 'show', converted.key], { terminal: 'a1' })).stdout, 'limpar o cache do runner', 'bo task show lista as memórias');
  await t.js(`const tk = S.store.state.tasks.find((x) => x.key === ${JSON.stringify(converted.key)}); (await import('./js/ui/tasks/selection.js')).openTask(tk.id);`);
  const drawer = await t.waitFor(async () => {
    const txt = await t.js(`return document.querySelector('#task-detail')?.innerText || ''`);
    return txt.includes('limpar o cache') && txt;
  });
  t.check(drawer && drawer.includes('Exportar a memória'), 'gaveta da tarefa mostra as memórias vinculadas', drawer);

  // seletor de memórias: filtro por tipo, várias de uma vez, e desmarcar
  const picker = {
    text: () => t.js(`return document.querySelector('.picker-card')?.innerText || ''`),
    chip: (label) => t.js(`[...document.querySelectorAll('.picker-card .chip')].find((c) => c.textContent === ${JSON.stringify(label)}).click()`),
    toggle: (part) => t.js(`[...document.querySelectorAll('.picker-card .pick-row')].find((r) => r.textContent.includes(${JSON.stringify(part)})).querySelector('input').click()`),
    save: () => t.js(`document.querySelector('.picker-card [type=submit]').click()`),
  };
  await t.js(`[...document.querySelectorAll('#task-detail button')].find((b) => b.textContent.includes('Vincular memórias')).click()`);
  const opened = await t.waitFor(async () => /Selecionadas/.test(await picker.text()) && picker.text());
  t.check(opened && opened.includes('limpar o cache') && opened.includes('Exportar a memória'), 'seletor abre com as já vinculadas no topo', opened);
  await picker.chip('Decisões');
  t.check(await t.waitFor(async () => { const x = await picker.text(); return x.includes('Usamos filas') && !x.includes('Eventos de domínio'); }), 'filtro por tipo mostra só decisões (e mantém as selecionadas)');
  await picker.toggle('Usamos filas');
  await picker.toggle('assíncrono por causa dos picos');
  await picker.chip('Tudo');
  await t.wait(400);
  await shot('seletor');
  await t.waitFor(async () => /Eventos de domínio/.test(await picker.text()));
  await picker.toggle('limpar o cache'); // desmarca o "como fazer"
  await picker.save();
  const kinds = await t.waitFor(async () => {
    const r = await data('get_task', { task: converted.key });
    return r.memories.length === 3 && r.memories.map((m) => m.kind).sort();
  });
  t.equal(kinds, ['decision', 'decision', 'idea'], 'salvar aplica a seleção inteira (acrescenta e remove)');

  // dentro do diálogo de memória, "Procurar…" abre o seletor por cima sem fechar o diálogo
  await t.js(`const m = await api.memory.get(${JSON.stringify(workers.id)}); D.editMemoryDialog(S.projectById('pA'), m);`, { D: './js/ui/memory/dialogs.js' });
  await t.waitFor(async () => /Vínculos/.test(await t.modal.text()));
  await t.js(`[...document.querySelectorAll('#modal button')].find((b) => b.textContent === 'Procurar…').click()`);
  await t.waitFor(async () => /Vínculos/.test(await picker.text()));
  await picker.toggle('Eventos de domínio');
  await picker.save();
  const rows = await t.waitFor(async () => { const x = await t.modal.text(); return x.includes('Eventos de domínio') && x; });
  t.check(rows && (await t.modal.open()), 'seletor sobre o diálogo acrescenta o vínculo e o diálogo continua aberto');
  await t.modal.submit();
  await t.waitFor(async () => !(await t.modal.open()));
  const wl = await data('memory_links', { id: workers.id });
  t.equal(wl.outgoing.map((l) => l.type).sort(), ['depends', 'depends'], 'novo vínculo pelo seletor entra como "apoia-se em"');

  // período: concluída há 20 dias some na "última semana" e volta em "último mês"
  await t.js(`const p = S.projectById('pA'); const last = p.taskColumns ? p.taskColumns.at(-1).id : null;
    const tk = S.store.state.tasks.find((x) => x.key === ${JSON.stringify(converted.key)});
    const cols = (await import('./js/tasks/columns.js')).columnsOf(p);
    tk.columnId = cols.at(-1).id; tk.updatedAt = Date.now() - 20 * 86400000; S.store.state.taskPeriod = '7d'; S.store.state.sideTab = 'tasks'; S.commit();`);
  const panelText = () => t.js(`return document.querySelector('#taskpanel').innerText`);
  t.check(await t.waitFor(async () => !(await panelText()).includes('Exportar a memória')), 'concluída antiga fica fora da última semana');
  await t.js(`(await import('./js/tasks/period.js')).setTaskPeriod('30d')`);
  t.check(await t.waitFor(async () => (await panelText()).includes('Exportar a memória')), 'no último mês ela aparece');
  t.includes(await panelText(), 'Último mês', 'seletor mostra o período atual');
});
