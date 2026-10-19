// Uma sessão de agente via ACP: inicia o processo do agente (pelo perfil), abre — ou continua — a
// sessão na pasta do terminal (com o MCP do Brain Organizer), envia prompts e repassa ao renderer:
//   { type: 'state', state }                 iniciando | pronto | trabalhando | encerrado
//   { type: 'session', sessionId, resumed }  sessão aberta (o renderer guarda o id para continuar)
//   { type: 'capabilities', canResume, canList }
//   { type: 'modes', current, available }    modos de permissão (default, acceptEdits, plan…)
//   { type: 'config', options }              opções do agente (modelo, esforço, modo…) — ver setConfig
//   { type: 'update', update }               session/update (mensagens, ferramentas, plano…)
//   { type: 'permission', requestId, toolCall, options }   o agente pede permissão (Em espera)
//   { type: 'turn', stopReason } | { type: 'error', message }
const { spawn } = require('child_process');
const fs = require('fs');
const { app } = require('electron');
const { RpcPeer } = require('./rpc');
const { agentCommand, boMcpServer, parseEnv } = require('./agents');
const { organizerEnv } = require('../pty');
const { childEnv } = require('../env');
const { PermissionGate } = require('./permissions');
const { promptBlocks } = require('./prompt-blocks');
const { parseMcpServers } = require('./mcp-servers');

const PROTOCOL_VERSION = 1;

class AgentSession {
  /** opts: { profile, cwd, resume } — `resume`: id de uma sessão anterior para continuar. */
  constructor(id, { profile = {}, cwd, resume = null }, emit) {
    this.id = id;
    this.profile = profile;
    this.resume = resume;
    this.cwd = cwd && fs.existsSync(cwd) ? cwd : app.getPath('home');
    this.emit = emit;
    this.gate = new PermissionGate(emit);
    this.stderr = '';
  }

  state(state) {
    this.current = state;
    this.emit({ type: 'state', state });
  }

  spawn() {
    const cmd = agentCommand(this.profile);
    const env = childEnv({ ...cmd.env, ...organizerEnv(this.id) });
    this.proc = spawn(cmd.command, cmd.args, { cwd: this.cwd, env, shell: cmd.shell, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', (d) => (this.stderr = (this.stderr + d).slice(-4000)));
    this.proc.on('error', (err) => this.emit({ type: 'error', message: `Não foi possível executar o agente: ${err.message}` }));
    this.proc.on('exit', (code) => {
      this.rpc?.close('O agente encerrou.');
      this.gate.cancelAll();
      if (this.current !== 'encerrado') this.emit({ type: 'error', message: `O agente encerrou (código ${code}). ${this.stderr.trim().split('\n').slice(-3).join(' ')}`.trim() });
      this.state('encerrado');
    });
    this.rpc = new RpcPeer(this.proc.stdout, this.proc.stdin);
    this.rpc.onNotification('session/update', (p) => this.emit({ type: 'update', update: p.update }));
    this.rpc.onRequest('session/request_permission', (p) => this.gate.ask(p));
  }

  /** MCP do Brain Organizer: só o que precisa para falar com a API como este terminal. */
  /** O MCP do Brain Organizer e os extras do perfil (ex.: Playwright). */
  mcpServers() {
    const { BO_API_URL, BO_API_TOKEN } = organizerEnv(this.id);
    const bo = BO_API_URL ? [boMcpServer({ BO_API_URL, BO_API_TOKEN, BO_TERMINAL_ID: this.id })] : [];
    // ${NOME} nos servidores vem das variáveis do perfil (ou do ambiente do app)
    return [...bo, ...parseMcpServers(this.profile.mcp, { ...process.env, ...parseEnv(this.profile.env) })];
  }

  async start() {
    this.state('iniciando');
    try {
      this.spawn();
      const init = await this.rpc.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: 'brain-organizer', title: 'Brain Organizer', version: app.getVersion() },
      });
      this.caps = init?.agentCapabilities || {};
      this.emit({ type: 'capabilities', canResume: !!this.caps.loadSession, canList: !!this.caps.sessionCapabilities?.list });
      await this.open();
      this.state('pronto');
    } catch (err) {
      this.emit({ type: 'error', message: `Não foi possível iniciar o agente: ${err.message}` });
      this.stop();
    }
  }

  /** Continua a sessão anterior (session/load: o agente reenvia a conversa) ou abre uma nova. */
  async open() {
    const params = { cwd: this.cwd, mcpServers: this.mcpServers() };
    let result = null;
    if (this.resume && this.caps.loadSession) {
      try {
        result = await this.rpc.request('session/load', { ...params, sessionId: this.resume });
        this.sessionId = this.resume;
      } catch (err) {
        this.emit({ type: 'error', message: `Não deu para continuar a sessão anterior (${err.message}); abrindo uma nova.` });
      }
    }
    if (!this.sessionId) {
      result = await this.rpc.request('session/new', params);
      this.sessionId = result.sessionId;
    }
    this.emit({ type: 'session', sessionId: this.sessionId, resumed: this.sessionId === this.resume });
    if (result?.configOptions) this.emit({ type: 'config', options: result.configOptions });
    await this.applyModes(result?.modes);
  }

  /** Modos anunciados pelo agente; aplica o modo padrão do perfil, se ele existir. */
  async applyModes(modes) {
    if (!modes?.availableModes?.length) return;
    this.modes = { current: modes.currentModeId, available: modes.availableModes };
    const wanted = this.profile.mode?.trim();
    if (wanted && wanted !== this.modes.current && this.modes.available.some((m) => m.id === wanted)) await this.setMode(wanted);
    else this.emit({ type: 'modes', ...this.modes });
  }

  async setMode(modeId) {
    await this.rpc.request('session/set_mode', { sessionId: this.sessionId, modeId });
    this.modes = { ...this.modes, current: modeId };
    this.emit({ type: 'modes', ...this.modes });
  }

  /**
   * Muda uma opção anunciada pelo agente (configOptions: modelo, esforço, modo…). O agente devolve
   * as opções atualizadas — o esforço disponível, por exemplo, depende do modelo.
   */
  async setConfig(configId, value) {
    const r = await this.rpc.request('session/set_config_option', { sessionId: this.sessionId, configId, value });
    if (r?.configOptions) this.emit({ type: 'config', options: r.configOptions });
    if (configId === 'mode' && this.modes) this.emit({ type: 'modes', ...(this.modes = { ...this.modes, current: value }) });
  }

  /** Sessões anteriores nesta pasta (para "Retomar…"). */
  async listSessions() {
    if (!this.caps?.sessionCapabilities?.list) return [];
    const r = await this.rpc.request('session/list', { cwd: this.cwd });
    return (r?.sessions || []).map((s) => ({ sessionId: s.sessionId, title: s.title || null, updatedAt: s.updatedAt || null }));
  }

  /** Um turno: texto e anexos do usuário; os eventos chegam por `emit` e o fim por { type: 'turn' }. */
  async prompt(text, attachments = []) {
    if (!this.sessionId) throw new Error('A sessão do agente ainda não está pronta.');
    let prompt;
    try {
      prompt = promptBlocks(text, attachments, this.caps);
    } catch (err) {
      return this.emit({ type: 'error', message: err.message });
    }
    this.state('trabalhando');
    try {
      const r = await this.rpc.request('session/prompt', { sessionId: this.sessionId, prompt });
      this.emit({ type: 'turn', stopReason: r?.stopReason || 'end_turn', usage: r?.usage || null }); // usage: tokens do turno
    } catch (err) {
      this.emit({ type: 'error', message: err.message });
    } finally {
      if (this.current === 'trabalhando') this.state('pronto');
    }
  }

  cancel() {
    if (!this.sessionId) return;
    this.gate.cancelAll();
    this.rpc.notify('session/cancel', { sessionId: this.sessionId });
  }

  answerPermission(requestId, optionId) {
    return this.gate.answer(requestId, optionId);
  }

  stop() {
    this.state('encerrado');
    this.gate.cancelAll();
    try {
      this.proc?.kill();
    } catch {}
  }
}

module.exports = { AgentSession };
