// Processos do Windows para os testes: lista via CIM (assíncrono — o processo principal atende a API).
const { execFile } = require('child_process');

const QUERY = 'Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine | ConvertTo-Json -Compress';

/** [{ pid, ppid, name, cmd }] de todos os processos. */
function listProcesses() {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', QUERY], { maxBuffer: 64 * 1024 * 1024 }, (err, out) => {
      if (err) return reject(err);
      resolve(JSON.parse(out).map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, name: p.Name, cmd: p.CommandLine || '' })));
    });
  });
}

/** Shells abertos por este app de teste: o --rcfile aponta para a pasta de dados da suíte. */
const shellsOf = (procs, ud) => {
  const rc = ud.replace(/\\/g, '/').toLowerCase();
  return procs.filter((p) => p.name === 'bash.exe' && p.cmd.replace(/\\/g, '/').toLowerCase().includes(rc));
};

module.exports = { listProcesses, shellsOf };
