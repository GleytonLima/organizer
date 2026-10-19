// AWS CLI falsa para os testes (BO_AWS_BIN): `sts get-caller-identity --profile X`.
//   dev        → conta 111122223333
//   prod-sso   → sessão SSO vencida (como a CLI de verdade responde)
//   outro      → erro genérico
const args = process.argv.slice(2);
const profile = args[args.indexOf('--profile') + 1];
if (args[0] !== 'sts') process.exit(2);
if (profile === 'dev') {
  console.log(JSON.stringify({ UserId: 'AIDAFAKE', Account: '111122223333', Arn: 'arn:aws:iam::111122223333:user/dev' }));
} else if (profile === 'prod-sso') {
  console.error('Error when retrieving token from sso: Token has expired and refresh failed');
  process.exit(255);
} else {
  console.error(`The config profile (${profile}) could not be found`);
  process.exit(255);
}
