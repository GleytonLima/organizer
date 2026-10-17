// Anexos da conversa de agente: prints (Ctrl+V com imagem), imagens e PDFs (arrastar ou o clipe).
// Imagens vão como dados no prompt (o modelo as vê); outros arquivos (PDF…) vão como link para o
// arquivo no disco, que o agente lê com as próprias ferramentas (o adaptador do Claude ignora blobs).
import { el, mount } from '../../core/dom.js';
import { icon } from '../icons.js';

const MAX_IMAGE = 5 * 1024 * 1024; // limite de imagem da API do Claude
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ACCEPT = [...IMAGE_TYPES, '.pdf'].join(',');

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** Arquivo → anexo { kind: image|file, name, mimeType, data + url (imagem) | path (arquivo) }. */
async function fromFile(file) {
  if (IMAGE_TYPES.has(file.type)) {
    if (file.size > MAX_IMAGE) throw new Error(`${file.name || 'A imagem'} passa de 5 MB.`);
    const url = await readDataUrl(file);
    return { kind: 'image', name: file.name || 'print.png', mimeType: file.type, data: url.slice(url.indexOf(',') + 1), url };
  }
  const path = window.api.filePath(file);
  if (!path) throw new Error(`Não foi possível anexar ${file.name || 'o arquivo'}: arraste-o do Explorer ou use o clipe.`);
  return { kind: 'file', name: file.name, mimeType: file.type || '', path };
}

/** Miniatura (imagem) ou ícone + nome de um anexo; com `onRemove`, mostra o ×. */
export function attachmentChip(a, onRemove = null) {
  return el(
    'div',
    { class: 'ag-attachment', title: a.path || a.name },
    a.kind === 'image' && a.url ? el('img', { src: a.url, alt: '' }) : icon('note'),
    el('span', { class: 'ag-attachment-name', text: a.name }),
    onRemove ? el('button', { class: 'icon-btn', title: 'Remover', onclick: onRemove }, icon('close')) : null,
  );
}

export function attachmentsBox({ onError }) {
  let list = [];
  const chips = el('div', { class: 'ag-attachments hidden' });
  const input = el('input', { type: 'file', multiple: true, accept: ACCEPT, class: 'hidden', onchange: () => add(input.files).then(() => (input.value = '')) });

  function draw() {
    chips.classList.toggle('hidden', !list.length);
    mount(chips, list.map((a) => attachmentChip(a, () => ((list = list.filter((x) => x !== a)), draw()))));
  }

  async function add(files) {
    for (const f of [...files]) {
      try {
        list.push(await fromFile(f));
      } catch (err) {
        onError(err.message);
      }
    }
    draw();
  }

  return {
    chips,
    button: el('button', { class: 'btn ghost ag-clip', title: 'Anexar imagem ou PDF (ou cole um print com Ctrl+V)', onclick: () => input.click() }, icon('clip'), input),
    get list() {
      return list;
    },
    clear() {
      list = [];
      draw();
    },
    /** Colar (Ctrl+V com imagem ou arquivo) na caixa e arrastar arquivos para a conversa. */
    bind(textarea, zone) {
      textarea.addEventListener('paste', (e) => {
        const files = [...(e.clipboardData?.files || [])];
        if (!files.length) return;
        e.preventDefault();
        add(files);
      });
      zone.addEventListener('dragover', (e) => {
        if (!e.dataTransfer?.types.includes('Files')) return;
        e.preventDefault();
        zone.classList.add('dropping');
      });
      zone.addEventListener('dragleave', (e) => !zone.contains(e.relatedTarget) && zone.classList.remove('dropping'));
      zone.addEventListener('drop', (e) => {
        zone.classList.remove('dropping');
        if (!e.dataTransfer?.files.length) return;
        e.preventDefault();
        add(e.dataTransfer.files);
      });
    },
  };
}
