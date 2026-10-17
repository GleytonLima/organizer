// Busca por similaridade (embeddings): provedor, URL, modelo e chave (guardada criptografada).
import { cleanError } from '../../core/errors.js';
import { openModal, field } from '../modal.js';

/** Embeddings opcionais: provedor, URL, modelo e chave (guardada criptografada). */
export async function embeddingsDialog() {
  const s = await api.memory.settings();
  const v = await openModal({
    title: 'Busca por similaridade (embeddings)',
    message: 'Opcional. A busca por texto funciona sempre; com embeddings, ela também encontra memórias por significado.',
    fields: [
      field.select('provider', 'Provedor', s.provider, {
        options: [
          { value: 'off', label: 'Desligado (só texto)' },
          { value: 'ollama', label: 'Ollama (local, gratuito)' },
          { value: 'openai', label: 'API compatível com OpenAI' },
        ],
      }),
      field.text('url', 'URL', s.provider === 'off' ? '' : s.url, { placeholder: 'padrão do provedor', mono: true }),
      field.text('model', 'Modelo', s.provider === 'off' ? '' : s.model, { placeholder: 'nomic-embed-text / text-embedding-3-small', mono: true }),
      field.text('apiKey', 'Chave de API (só OpenAI)', '', { placeholder: s.hasKey ? '•••••• (guardada; deixe vazio para manter)' : '', mono: true }),
    ],
    submit: 'Salvar e testar',
  });
  if (!v) return;
  try {
    await api.memory.saveSettings(v);
  } catch (err) {
    return openModal({ title: 'Não foi possível salvar', message: cleanError(err) });
  }
  if (v.provider === 'off') return;
  try {
    const r = await api.memory.testEmbeddings();
    await openModal({ title: 'Embeddings funcionando', message: `${r.model}: vetores de ${r.dimensions} dimensões. As memórias existentes estão sendo indexadas em segundo plano.` });
  } catch (err) {
    await openModal({ title: 'Embeddings indisponíveis', message: `${cleanError(err)} — a busca por texto continua funcionando.` });
  }
}
