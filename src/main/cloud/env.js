// Variáveis de nuvem que um terminal/agente recebe do projeto: só AWS_PROFILE e a região, validados
// (o valor vem do renderer e vira ambiente de um processo — nada além disso passa).
const PROFILE = /^[\w.@+-]{1,64}$/;
const REGION = /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

/** { profile, region } → { AWS_PROFILE, AWS_REGION, AWS_DEFAULT_REGION } (o que for válido). */
function cloudEnv(cloud) {
  const env = {};
  if (cloud?.profile && PROFILE.test(cloud.profile)) env.AWS_PROFILE = cloud.profile;
  if (cloud?.region && REGION.test(cloud.region)) env.AWS_REGION = env.AWS_DEFAULT_REGION = cloud.region;
  return env;
}

module.exports = { cloudEnv, PROFILE, REGION };
