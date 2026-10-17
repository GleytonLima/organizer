// Prompt do ACP a partir do texto e dos anexos: imagem vira bloco "image" (base64); arquivo (PDF…)
// vira "resource_link" para o caminho no disco — o adaptador do Claude ignora blobs, e o agente
// lê o arquivo com as próprias ferramentas.
const { pathToFileURL } = require('url');

function promptBlocks(text, attachments = [], caps = {}) {
  const blocks = text ? [{ type: 'text', text }] : [];
  for (const a of attachments) {
    if (a.kind === 'image' && a.data) {
      if (!caps.promptCapabilities?.image) throw new Error('Este agente não aceita imagens.');
      blocks.push({ type: 'image', mimeType: a.mimeType, data: a.data });
    } else if (a.path) {
      blocks.push({ type: 'resource_link', uri: pathToFileURL(a.path).href, name: a.name, ...(a.mimeType && { mimeType: a.mimeType }) });
    }
  }
  if (!blocks.length) throw new Error('Mensagem vazia.');
  return blocks;
}

module.exports = { promptBlocks };
