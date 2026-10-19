// Agentes de IA que os Primeiros passos sabem instalar, logar e conectar ao app. Cada módulo tem:
//   id, label, about, status() → { installed, version, loggedIn, connected, acp? },
//   install (em segundo plano, { command, addPath? }) ou installTerminal (linha para um terminal do app),
//   loginCommand() (linha para um terminal), preview() (o que "Conectar" grava) e connect() → { profile? }.
const AGENTS = [require('./claude'), require('./devin')];

const agentById = (id) => {
  const a = AGENTS.find((x) => x.id === id);
  if (!a) throw new Error(`Agente desconhecido: ${id}`);
  return a;
};

/** Situação de todos, com o que a tela precisa para oferecer os botões. */
const agentsStatus = () =>
  Promise.all(
    AGENTS.map(async (a) => ({
      id: a.id,
      label: a.label,
      about: a.about,
      installMode: a.installTerminal ? 'terminal' : 'background',
      installCommand: a.installTerminal || null,
      loginCommand: a.loginCommand(),
      ...(await a.status()),
    })),
  );

module.exports = { AGENTS, agentById, agentsStatus };
