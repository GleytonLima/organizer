// Perfis de agente ACP: qual agente iniciar e como (comando, argumentos, variáveis, modo padrão).
// O "claude" é embutido (adaptador do Claude Code no próprio app): só modo e variáveis mudam.
//   { id, label, builtin?, command, args, env: "NOME=valor por linha", mode, mcp: JSON "mcpServers" (./mcp-config.js) }
import { store, commit } from '../core/store.js';
import { uid } from '../core/model.js';
import { checkMcp, mcpMap, formatMcp } from './mcp-config.js';

export const DEFAULT_AGENT_PROFILES = () => [{ id: 'claude', label: 'Claude Code', builtin: true, command: '', args: '', env: '', mode: '', mcp: '' }];

export const agentProfiles = () => store.state.agentProfiles;
export const profileById = (id) => agentProfiles().find((p) => p.id === id) || agentProfiles()[0];

export function saveProfile(data) {
  const label = String(data.label || '').trim();
  if (!label) throw new Error('Dê um nome ao agente.');
  checkMcp(data.mcp);
  const existing = data.id && agentProfiles().find((p) => p.id === data.id);
  if (!existing?.builtin && !String(data.command || '').trim()) throw new Error('Informe o comando que inicia o agente em modo ACP (ex.: gemini).');
  const mcp = formatMcp(mcpMap(data.mcp)); // salvo sempre como JSON (o formato antigo é convertido)
  const clean = { label, args: String(data.args || '').trim(), env: String(data.env || ''), mode: String(data.mode || '').trim(), mcp };
  if (existing) Object.assign(existing, clean, existing.builtin ? {} : { command: String(data.command).trim() });
  else store.state.agentProfiles.push({ id: uid(), ...clean, command: String(data.command).trim() });
  commit();
}

export function removeProfile(profile) {
  if (profile.builtin) throw new Error('O perfil embutido não pode ser removido.');
  store.state.agentProfiles = agentProfiles().filter((p) => p !== profile);
  commit();
}
