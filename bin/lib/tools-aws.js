// Ferramentas MCP do catálogo de contas AWS: a IA descobre qual perfil é "a conta de hom da Loja".
const AWS_TOOLS = [
  {
    name: 'list_aws_profiles',
    description:
      'Lista as contas AWS do usuário: perfil (nome em ~/.aws), apelido, sistema, ambiente (dev/hom/prod), conta, região e ' +
      'se a sessão está válida. Use para traduzir pedidos como "olhe os logs da Loja em homologação" no perfil certo. ' +
      'Regras: passe SEMPRE --profile <perfil> nos comandos aws (não dependa do perfil padrão do terminal); em perfil de ' +
      'ambiente "prod", confirme com o usuário antes de qualquer comando que altere algo; sessão "expired": peça ao usuário ' +
      'para entrar de novo (o app mostra "Entrar"), não tente contornar.',
    inputSchema: { type: 'object', properties: { check: { type: 'boolean', description: 'false = não conferir as contas agora (mais rápido).' } } },
    run: (request, args) => request('aws_profiles', args),
  },
  {
    name: 'aws_identity',
    description: 'Confere agora em que conta um perfil AWS está e se a sessão é válida (aws sts get-caller-identity).',
    inputSchema: { type: 'object', properties: { profile: { type: 'string', description: 'Nome do perfil (de list_aws_profiles).' } }, required: ['profile'] },
    run: (request, args) => request('aws_identity', args),
  },
];

module.exports = { AWS_TOOLS };
