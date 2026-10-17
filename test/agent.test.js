// Sessão de agente via ACP (experimento): terminal do tipo "agente" conversando com um agente ACP
// falso (test/fixtures/fake-acp-agent.js). 1ª execução: conversa, "Em espera" automático, modos e
// perfis. 2ª execução (app reaberto): a sessão continua sozinha; Retomar… e Nova sessão.
const os = require('os');
const path = require('path');
const { suite, seed } = require('./harness');

process.env.BO_ACP_AGENT = JSON.stringify([process.execPath, path.join(__dirname, 'fixtures', 'fake-acp-agent.js')]);
process.env.FAKE_ACP_STORE = path.join(process.env.BO_TEST_DIR || os.tmpdir(), 'acp-sessions.json');

/** App reaberto: o terminal de agente continua a última sessão; dá para retomar outra ou abrir nova. */
async function reopened(t) {
  const id = await t.js(`return S.store.state.projects[0].groups[0].terminals.find((x) => x.kind === 'agent')?.id`);
  const s = (expr) => t.js(`const s = SE.getSession(${JSON.stringify(id)}); return ${expr};`);
  const view = () => s('s.body.textContent'); // o terminal ativo ao reabrir é outro: este fica oculto
  t.check(await t.waitFor(async () => (await view()).includes('Sessão anterior retomada.')), 'ao reabrir o app, o terminal continua a última sessão');
  const replay = await view();
  t.check(replay.includes('De novo, por favor') && replay.includes('Ok, não editei.'), 'a conversa anterior volta (o agente a reenvia)', replay.slice(0, 400));
  const before = await t.js(`return S.store.state.projects[0].groups[0].terminals.find((x) => x.kind === 'agent').acpSessionId`);
  const listed = await s('s.listSessions()');
  t.check(listed.length >= 2 && listed.some((x) => x.sessionId === before), 'Retomar… lista as sessões anteriores da pasta', JSON.stringify(listed));
  const other = listed.find((x) => x.sessionId !== before);
  await s(`s.restart({ resume: ${JSON.stringify(other.sessionId)} })`);
  t.check(await t.waitFor(async () => (await view()).includes('Olá do perfil') || (await view()).includes('Sessão anterior retomada.')), 'retomar outra sessão traz a conversa dela');
  t.equal(await t.waitFor(() => t.js(`return S.store.state.projects[0].groups[0].terminals.find((x) => x.kind === 'agent').acpSessionId === ${JSON.stringify(other.sessionId)}`)), true, 'o terminal passa a seguir a sessão retomada');
  await t.waitFor(async () => (await s('s.state')) === 'pronto');
  await s('s.restart({ resume: null })');
  await t.waitFor(async () => (await s('s.state')) === 'pronto');
  const fresh = await t.js(`return S.store.state.projects[0].groups[0].terminals.find((x) => x.kind === 'agent').acpSessionId`);
  t.check(fresh && fresh !== other.sessionId && !(await view()).includes('De novo'), 'Nova sessão começa do zero');
}

suite('agente via ACP', {
  seed: (dir) => {
    const [repo] = seed.makeFolders(path.join(dir, 'repos'), ['app']);
    return seed.state([seed.project('pA', 'App', [repo], [seed.group('gA', 'Terminais', [seed.term('a1', 'a1', repo)])])]);
  },
}, async (t) => {
  if (t.run > 1) return reopened(t);
  // cria o terminal de agente pelo mesmo caminho do menu
  const id = await t.js(`const A = await import('./js/actions/terminals.js'); A.newAgentTerminal(S.projectById('pA').groups[0]); return S.store.state.activeId;`);
  const state = () => t.js(`return SE.getSession(${JSON.stringify(id)})?.state`);
  t.equal(await t.waitFor(async () => (await state()) === 'pronto' && 'pronto'), 'pronto', 'terminal de agente inicia a sessão ACP');
  const view = () => t.js(`return SE.getSession(${JSON.stringify(id)}).body.innerText`);
  const shot = async (name) => process.env.BO_TEST_SHOTS && require('fs').writeFileSync(path.join(process.env.BO_TEST_SHOTS, `agent-${name}.png`), (await t.wc.capturePage()).toPNG());
  t.includes(await view(), 'Claude Code · ACP · pronto', 'tela mostra o agente e o estado');
  t.check(await t.js(`return !!document.querySelector('#sidebar .term-icon')`), 'terminal aparece na barra lateral');

  // 1º pedido: cria a tarefa e o pedido de permissão vira Em espera com as opções
  await t.js(`const s = SE.getSession(${JSON.stringify(id)}); s.view.textarea.value = 'Ajuste a config de cache para 60 s'; s.view.sendBtn.click();`);
  const task = () => t.js(`const x = S.store.state.tasks.find((k) => k.terminalId === ${JSON.stringify(id)}); return x && { key: x.key, title: x.title, waiting: x.needsInput, history: x.history.map((h) => h.text) };`);
  const waiting = await t.waitFor(async () => (await task())?.waiting);
  const created = await task();
  t.equal(created?.title, 'Ajuste a config de cache para 60 s', 'o 1º pedido cria a tarefa do terminal');
  t.check(waiting?.question.includes('Editar config.json') && waiting.choices.map((c) => c.label).join() === 'Permitir,Recusar', 'pedido de permissão deixa a tarefa Em espera com as opções', JSON.stringify(waiting));
  t.includes(await view(), 'Pede permissão: Editar config.json', 'a conversa mostra o pedido com botões');
  await t.js(`S.store.state.taskView = 'panel'; S.store.state.sideTab = 'tasks'; S.commit();`);
  await t.wait(300);
  await shot('espera');
  t.includes((await t.bo(['task', 'waiting'], { terminal: 'a1' })).stdout, created.key, 'bo task waiting lista a tarefa');

  // responder pela tarefa (gaveta): o agente segue e o turno vira relato
  await t.js(`const k = S.store.state.tasks.find((x) => x.terminalId === ${JSON.stringify(id)}); (await import('./js/ui/tasks/selection.js')).openTask(k.id);`);
  await t.waitFor(() => t.js(`return [...document.querySelectorAll('#task-detail button')].some((b) => b.textContent === 'Permitir')`));
  await t.js(`[...document.querySelectorAll('#task-detail button')].find((b) => b.textContent === 'Permitir').click()`);
  t.check(await t.waitFor(async () => (await view()).includes('Pronto: config atualizada')), 'responder na tarefa libera o agente');
  const after = await task();
  t.check(!after.waiting && after.history.some((h) => h.includes('Respondeu: Permitir')), 'a espera termina e fica no histórico', JSON.stringify(after.history));
  t.check(after.history.some((h) => h.includes('Pronto: config atualizada')), 'fim do turno vira relato na tarefa');
  t.includes(await view(), 'feito', 'ferramenta aparece concluída');

  // 2º pedido: responder pelo próprio terminal (botão na conversa)
  await t.js(`const s = SE.getSession(${JSON.stringify(id)}); s.view.textarea.value = 'De novo, por favor'; s.view.sendBtn.click();`);
  await t.waitFor(async () => (await task())?.waiting);
  await t.js(`[...SE.getSession(${JSON.stringify(id)}).body.querySelectorAll('.ag-permission.open button')].find((b) => b.textContent === 'Recusar').click()`);
  t.check(await t.waitFor(async () => (await view()).includes('Ok, não editei')), 'responder no terminal também segue o agente');
  t.check(!(await task()).waiting, 'e encerra a espera da tarefa');

  // "responder no terminal de origem" (writeWhenReady) vira mensagem para o agente; interromper cancela a espera
  await t.js(`await SE.writeWhenReady(${JSON.stringify(id)}, 'Mais uma vez\\r')`);
  await t.waitFor(async () => (await task())?.waiting);
  t.includes(await view(), 'Mais uma vez', 'texto enviado ao terminal vira mensagem do usuário');
  await t.js(`SE.getSession(${JSON.stringify(id)}).cancel()`);
  t.check(await t.waitFor(async () => (await view()).includes('Interrompido.')), 'interromper encerra o turno');
  t.check(await t.waitFor(async () => !(await task()).waiting), 'e a espera da tarefa');

  // erro do agente aparece na conversa
  await t.waitFor(async () => (await state()) === 'pronto');
  await t.js(`SE.getSession(${JSON.stringify(id)}).send('provoque um erro')`);
  t.check(await t.waitFor(async () => (await view()).includes('Falha simulada do agente.')), 'erro do agente aparece na conversa');

  // leitura pela API (read_terminal) traz a conversa
  t.includes(await t.js(`return B.readLines(${JSON.stringify(id)}, 50)`), '> De novo, por favor', 'ler o terminal devolve a conversa');

  // modos: o seletor lista os modos do agente; em "Aceitar edições" ele não pede permissão
  const modes = await t.js(`return [...SE.getSession(${JSON.stringify(id)}).body.querySelectorAll('.ag-mode option')].map((o) => o.textContent)`);
  t.equal(modes, ['Padrão', 'Aceitar edições', 'Planejar'], 'seletor mostra os modos anunciados pelo agente');
  await t.js(`const sel = SE.getSession(${JSON.stringify(id)}).body.querySelector('.ag-mode'); sel.value = 'acceptEdits'; sel.dispatchEvent(new Event('change'));`);
  t.equal(await t.waitFor(() => t.js(`return SE.getSession(${JSON.stringify(id)}).modes?.current === 'acceptEdits' && 'acceptEdits'`)), 'acceptEdits', 'trocar o modo vale na sessão');
  await t.js(`SE.getSession(${JSON.stringify(id)}).send('Edite sem perguntar')`);
  t.check(await t.waitFor(async () => { const v = await view(); return v.slice(v.lastIndexOf('Edite sem perguntar')).includes('Pronto: config atualizada'); }), 'em "Aceitar edições" o agente segue sem pedir permissão');
  t.check(!(await task()).waiting, 'e a tarefa não entra em espera');

  // perfis: um agente próprio com variáveis e modo padrão
  const second = await t.js(`const P = await import('./js/agents/profiles.js');
    P.saveProfile({ label: 'Fake 2', command: 'fake-acp', args: '--acp', env: 'FAKE_GREETING=Olá do perfil', mode: 'plan' });
    const p = P.agentProfiles().find((x) => x.label === 'Fake 2');
    (await import('./js/actions/terminals.js')).newAgentTerminal(S.projectById('pA').groups[0], p.id);
    return S.store.state.activeId;`);
  const s2 = (expr) => t.js(`const s = SE.getSession(${JSON.stringify(second)}); return ${expr};`);
  t.equal(await t.waitFor(() => s2(`s.state === 'pronto' && s.modes?.current`)), 'plan', 'perfil abre a sessão no modo padrão dele');
  t.includes(await t.js(`return document.querySelector('#sidebar').innerText`), 'Fake 2 (ACP)', 'terminal leva o nome do perfil');
  await s2(`s.send('Oi')`);
  t.check(await t.waitFor(async () => (await s2('s.body.innerText')).includes('Olá do perfil')), 'variáveis do perfil chegam ao agente');
  await s2(`s.answer(1, 'reject')`);
  await t.waitFor(async () => (await s2('s.state')) === 'pronto');
});
