// Fim de `playwright test` num terminal (qualquer um): passou → aviso; falhou → aviso + tarefa com o
// resumo (contagens e testes que falharam) e o caminho do relatório. Uma falha seguida na mesma pasta
// acrescenta um relato à tarefa aberta em vez de criar outra.
import { findTerm } from '../core/store.js';
import { pushNotification } from '../notify/center.js';
import { createTask, reportTask } from '../actions/tasks.js';
import { addTaskTags } from '../actions/task-tags.js';
import { projectTasks } from '../tasks/queries.js';
import { isDoneColumn } from '../tasks/columns.js';
import { readLines } from '../terminals/buffer.js';
import { refreshPlaywright } from './runner.js';

const isRun = (cmd) => /\bplaywright\s+test\b/.test(cmd || '');
const TAG = 'playwright';

/** Contagens ("3 failed", "12 passed"…) e as linhas dos testes que falharam — só da última execução
 *  (a partir do último "Running N tests"), não das anteriores que ainda estão na tela. */
export function summarize(text) {
  const all = String(text || '').split('\n');
  const start = all.findLastIndex((l) => /^Running \d+ tests?\b/.test(l.trim()));
  const lines = start >= 0 ? all.slice(start) : all;
  const counts = lines.map((l) => l.trim()).filter((l) => /^\d+ (passed|failed|flaky|skipped|did not run|interrupted)\b/.test(l));
  const failures = lines.map((l) => l.trim()).filter((l) => /^\d+\)\s/.test(l) || /^[✘×]\s/.test(l));
  return { counts, failures: [...new Set(failures)].slice(0, 15) };
}

const repoName = (folder) => folder.split(/[\\/]/).filter(Boolean).at(-1);

/** Chamado no fim de cada comando (OSC 6973;end). Devolve true se era um `playwright test`. */
export function playwrightFinished(id, running, exitCode) {
  if (!running || !isRun(running.cmd)) return false;
  const entry = findTerm(id);
  if (!entry) return false;
  // o ConPTY do Windows entrega o OSC de fim antes do texto desenhado: lê a saída um instante depois
  setTimeout(() => report(id, entry, exitCode), SETTLE_MS);
  return true;
}

const SETTLE_MS = 300;

function report(id, entry, exitCode) {
  const folder = entry.t.cwd;
  const repo = repoName(folder);
  const { counts, failures } = summarize(readLines(id, 300));
  refreshPlaywright(folder).then((info) => (exitCode ? onFail(entry, { repo, folder, counts, failures, report: info?.report }) : null));
  const summary = counts.length ? ` (${counts.join(', ')})` : '';
  if (!exitCode) pushNotification({ terminalId: id, label: `Playwright · ${repo}`, body: `passou${summary}` });
}

function onFail({ project, t }, { repo, folder, counts, failures, report }) {
  const title = `Testes Playwright falhando em ${repo}`;
  const body = [
    counts.length ? counts.join(', ') : 'O comando saiu com erro.',
    failures.length ? `\nFalharam:\n${failures.join('\n')}` : '',
    report ? `\nRelatório: ${report}` : '',
    `\nPasta: ${folder}`,
  ].join('\n');
  const open = projectTasks(project).find((k) => k.title === title && !isDoneColumn(project, k.columnId));
  const task = open || createTask(project, { title, description: body, terminalId: t.id, by: 'agente' });
  if (open) reportTask(open, body, { by: 'agente', terminalId: t.id });
  else addTaskTags(task, [TAG], { by: 'agente' });
  pushNotification({ terminalId: t.id, taskId: task.id, label: `Playwright · ${repo}`, body: `falhou${counts.length ? ` (${counts.join(', ')})` : ''}` });
}
