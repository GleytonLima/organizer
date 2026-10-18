// Embeddings opcionais (desligados por padrão). Provedores plugáveis:
//   ollama — modelo local (ex.: nomic-embed-text), sem custo, precisa do Ollama rodando
//   openai — qualquer API compatível com /v1/embeddings (OpenAI, Azure, LM Studio…)
// A chave de API é guardada criptografada com o cofre do sistema (safeStorage).
const { safeStorage } = require('electron');
const { userFile, readJson, writeJsonAtomic } = require('../files');
const { openDb } = require('./db');

const SETTINGS_FILE = () => userFile('memory-settings.json');
const TIMEOUT_MS = 20000;
const BATCH = 32;

const PROVIDERS = {
  ollama: {
    defaults: { url: 'http://127.0.0.1:11434', model: 'nomic-embed-text' },
    async embed(texts, s) {
      const j = await postJson(`${s.url}/api/embed`, { model: s.model, input: texts });
      return j.embeddings;
    },
  },
  openai: {
    defaults: { url: 'https://api.openai.com/v1', model: 'text-embedding-3-small' },
    async embed(texts, s) {
      const j = await postJson(`${s.url}/embeddings`, { model: s.model, input: texts }, s.apiKey);
      return j.data.map((d) => d.embedding);
    },
  },
};

async function postJson(url, body, apiKey) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey && { Authorization: `Bearer ${apiKey}` }) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- configuração ----------
function rawSettings() {
  return { provider: 'off', url: '', model: '', apiKeyEnc: null, ...readJson(SETTINGS_FILE(), {}) };
}

function decryptKey(enc) {
  if (!enc || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return null;
  }
}

/** Configuração efetiva (com a chave descriptografada) — só para uso interno. */
function settings() {
  const s = rawSettings();
  const defaults = PROVIDERS[s.provider]?.defaults || {};
  return { provider: s.provider, url: (s.url || defaults.url || '').replace(/\/+$/, ''), model: s.model || defaults.model || '', apiKey: decryptKey(s.apiKeyEnc) };
}

/** Configuração visível na interface (nunca devolve a chave). */
function publicSettings() {
  const s = settings();
  return { provider: s.provider, url: s.url, model: s.model, hasKey: !!s.apiKey, providers: Object.keys(PROVIDERS) };
}

function saveSettings({ provider, url, model, apiKey }) {
  if (provider !== 'off' && !PROVIDERS[provider]) throw new Error(`Provedor desconhecido: ${provider}`);
  const cur = rawSettings();
  const next = { ...cur, provider, url: url || '', model: model || '' };
  // trocou de provedor ou de endereço: a chave antiga não vai para o novo destino
  if (cur.provider !== provider || (cur.url || '') !== (url || '')) delete next.apiKeyEnc;
  if (apiKey) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Criptografia do sistema indisponível para guardar a chave.');
    next.apiKeyEnc = safeStorage.encryptString(apiKey).toString('base64');
  }
  writeJsonAtomic(SETTINGS_FILE(), next);
  return publicSettings();
}

const enabled = () => settings().provider !== 'off';

async function embed(texts) {
  const s = settings();
  const provider = PROVIDERS[s.provider];
  if (!provider) throw new Error('Embeddings desligados.');
  const vectors = await provider.embed(texts, s);
  if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error('Resposta de embeddings inesperada.');
  return vectors.map((v) => Float32Array.from(v));
}

// ---------- indexação ----------
const embedText = (r) => [r.text, r.tags && `tags: ${r.tags}`, r.repo && `repo: ${r.repo}`].filter(Boolean).join('\n');
let running = null;

/** Gera embeddings para o que ainda não tem (ou foi gerado com outro modelo). Em segundo plano. */
function embedPending() {
  if (!enabled() || running) return running;
  running = (async () => {
    const model = settings().model;
    const db = openDb();
    let done = 0;
    for (;;) {
      const rows = db.prepare('SELECT id, text, tags, repo FROM memories WHERE embedding_model IS NOT ? LIMIT ?').all(model, BATCH);
      if (!rows.length) break;
      const vectors = await embed(rows.map(embedText));
      const upd = db.prepare('UPDATE memories SET embedding = ?, embedding_model = ? WHERE id = ?');
      rows.forEach((r, i) => upd.run(Buffer.from(vectors[i].buffer), model, r.id));
      done += rows.length;
    }
    return done;
  })().finally(() => (running = null));
  return running;
}

async function testEmbeddings() {
  const [v] = await embed(['teste de conexão']);
  return { ok: true, dimensions: v.length, model: settings().model };
}

module.exports = { settings, publicSettings, saveSettings, enabled, embed, embedPending, testEmbeddings };
