// Projetos compartilhados com o time (Configurações → Servidor do time): "Compartilhar" dá ao
// projeto uma chave de workspace; "Parar" volta a deixá-lo só nesta máquina (nada é apagado).
import { el } from '../../core/dom.js';
import { projects } from '../../core/store.js';
import { openModal, field } from '../modal.js';
import { setSyncKey } from '../../actions/projects.js';

const slug = (name) =>
  String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';

async function share(project) {
  const v = await openModal({
    title: `Compartilhar “${project.name}”`,
    message: 'Memórias, quadro de tarefas, pastas e colunas deste projeto passam a sincronizar com o time. Quem usar a mesma chave verá o mesmo projeto.',
    fields: [field.text('key', 'Chave do projeto no servidor', project.syncKey || slug(project.name), { mono: true, hint: 'Use a mesma chave que o time já usa, se o projeto já existir lá.' })],
    submit: 'Compartilhar',
  });
  if (v?.key?.trim()) setSyncKey(project, v.key);
}

async function stop(project) {
  const ok = await openModal({
    title: `Parar de sincronizar “${project.name}”?`,
    message: 'O projeto continua aqui como está; só deixa de receber e enviar mudanças do time.',
    submit: 'Parar',
  });
  if (ok) setSyncKey(project, '');
}

export function sharedProjectsList() {
  return el(
    'div',
    { class: 'set-list' },
    el('div', { class: 'set-hint', text: 'Projetos' }),
    projects().map((p) =>
      el(
        'div',
        { class: 'set-list-row' },
        el('span', { class: p.syncKey ? '' : 'set-hint', text: p.syncKey ? p.name : `${p.name} · só nesta máquina` }),
        p.syncKey ? el('span', { class: 'set-key', text: p.syncKey }) : null,
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'link', onclick: () => (p.syncKey ? stop(p) : share(p)), text: p.syncKey ? 'Parar' : 'Compartilhar' }),
      ),
    ),
  );
}
