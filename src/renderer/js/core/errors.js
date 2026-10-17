/** Mensagem de erro sem o prefixo técnico do IPC do Electron ("Error invoking remote method 'x': Error: …"). */
export const cleanError = (err) =>
  String(err?.message ?? err).replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
