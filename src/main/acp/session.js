// Uma sessão de agente via ACP: inicia o processo do agente, abre a sessão na pasta do terminal
// (com o MCP do Bash Organizer), envia prompts e repassa ao renderer tudo o que acontece:
//   { type: 'state', state }              iniciando | pronto | trabalhando | encerrado | erro
//   { type: 'update', update }            session/update (mensagens, ferramentas, plano…)
//   { type: 'permission', requestId, toolCall, options }   o agente pede permissão (Em espera)
//   { type: 'turn', stopReason }          o turno terminou
//   { type: 'error', message }
const { spawn } = require('child_process');
const fs = require('fs');
const { app } = require('electron');
const { RpcPeer } = require('./rpc');
const { agentCommand, boMcpServer } = require('./agents');
const { organizerEnv } = require('../pty');
const { childEnv } = require('../env');

const PROTOCOL_VERSION = 1;

class AgentSession {
  constructor(id, { agent, cwd }, emit) {
    this.id = id;
    this.agent = agent;
    this.cwd = cwd && fs.existsSync(cwd) ? cwd : app.getPath('home');
    this.emit = emit;
    this.permissions = new Map(); // requestId → resolve
    this.permissionSeq = 0;
    this.stderr = '';
  }

  state(state) {
    this.current = state;
    this.emit({ type: 'state', state });
  }

  async start() {
    this.state('iniciando');
    const cmd = agentCommand(this.agent);
    const env = childEnv({ ...cmd.env, ...organizerEnv(this.id) });
    this.proc = spawn(cmd.command, cmd.args, { cwd: this.cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', (d) => (this.stderr = (this.stderr + d).slice(-4000)));
    this.proc.on('exit', (code) => {
      this.rpc?.close('O agente encerrou.');
      this.cancelPermissions();
      if (this.current !== 'encerrado') this.emit({ type: 'error', message: `O agente encerrou (código ${code}). ${this.stderr.trim().split('\n').slice(-3).join(' ')}`.trim() });
      this.state('encerrado');
    });
    this.rpc = new RpcPeer(this.proc.stdout, this.proc.stdin);
    this.rpc.onNotification('session/update', (p) => this.emit({ type: 'update', update: p.update }));
    this.rpc.onRequest('session/request_permission', (p) => this.askPermission(p));
    try {
      await this.rpc.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: 'bash-organizer', title: 'Bash Organizer', version: app.getVersion() },
      });
      // o MCP do Bash Organizer recebe só o que precisa para falar com a API como este terminal
      const { BO_API_URL, BO_API_TOKEN } = organizerEnv(this.id);
      const mcp = boMcpServer({ BO_API_URL, BO_API_TOKEN, BO_TERMINAL_ID: this.id });
      const session = await this.rpc.request('session/new', { cwd: this.cwd, mcpServers: BO_API_URL ? [mcp] : [] });
      this.sessionId = session.sessionId;
      this.state('pronto');
    } catch (err) {
      this.emit({ type: 'error', message: `Não foi possível iniciar o agente: ${err.message}` });
      this.stop();
    }
  }

  /** Um turno: o texto do usuário; resolve quando o agente termina (stopReason). */
  async prompt(text) {
    if (!this.sessionId) throw new Error('A sessão do agente ainda não está pronta.');
    this.state('trabalhando');
    try {
      const r = await this.rpc.request('session/prompt', { sessionId: this.sessionId, prompt: [{ type: 'text', text }] });
      this.emit({ type: 'turn', stopReason: r?.stopReason || 'end_turn' });
    } catch (err) {
      this.emit({ type: 'error', message: err.message });
    } finally {
      if (this.current === 'trabalhando') this.state('pronto');
    }
  }

  cancel() {
    if (!this.sessionId) return;
    this.cancelPermissions();
    this.rpc.notify('session/cancel', { sessionId: this.sessionId });
  }

  /** Pedido de permissão do agente: vai para o renderer (e para a tarefa, em espera) até alguém responder. */
  askPermission({ toolCall, options }) {
    const requestId = ++this.permissionSeq;
    return new Promise((resolve) => {
      this.permissions.set(requestId, resolve);
      this.emit({ type: 'permission', requestId, toolCall, options });
    });
  }

  answerPermission(requestId, optionId) {
    const resolve = this.permissions.get(requestId);
    if (!resolve) return false;
    this.permissions.delete(requestId);
    resolve({ outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } });
    this.emit({ type: 'permission-answered', requestId, optionId });
    return true;
  }

  cancelPermissions() {
    for (const id of [...this.permissions.keys()]) this.answerPermission(id, null);
  }

  stop() {
    this.state('encerrado');
    this.cancelPermissions();
    try {
      this.proc?.kill();
    } catch {}
  }
}

module.exports = { AgentSession };
