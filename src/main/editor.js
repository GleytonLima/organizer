// "Abrir no VS Code": roda `code <pasta>` (o code.cmd do PATH, por isso pelo shell). BO_EDITOR
// (JSON [comando, ...args], como BO_ACP_AGENT) troca o comando — usado nos testes.
const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');

function editorCommand(folder) {
  const override = process.env.BO_EDITOR;
  if (override) {
    const [command, ...args] = JSON.parse(override);
    return { command, args: [...args, folder], shell: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } };
  }
  return { command: 'code', args: [`"${folder}"`], shell: true, env: process.env };
}

/** Abre a pasta no editor; resolve { ok } ou { ok: false, error } (ex.: `code` fora do PATH). */
function openInEditor(folder) {
  if (!folder || !fs.existsSync(folder)) return Promise.resolve({ ok: false, error: `Pasta não encontrada: ${folder}` });
  const { command, args, shell, env } = editorCommand(folder);
  return new Promise((resolve) => {
    let stderr = '';
    const p = spawn(command, args, { cwd: folder, env, shell, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    p.stderr.on('data', (d) => (stderr += d));
    p.on('error', (err) => resolve({ ok: false, error: err.message }));
    p.on('exit', (code) =>
      resolve(code === 0 ? { ok: true } : { ok: false, error: stderr.trim() || `O comando "${command}" saiu com código ${code}.` }),
    );
  });
}

function registerEditorIpc() {
  ipcMain.handle('editor:open', (_e, folder) => openInEditor(folder));
}

module.exports = { registerEditorIpc, openInEditor };
