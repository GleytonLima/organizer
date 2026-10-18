#!/usr/bin/env bash
# Analisa os três projetos no SonarQube local (tools/sonar/docker-compose.yml) e mostra as notas.
#   bash tools/sonar/analyze.sh            # todos
#   bash tools/sonar/analyze.sh organizer  # só um (organizer | bo-memory-server | bo-memory-web)
# Token: SONAR_TOKEN ou tools/sonar/.token (fora do git). Sem nenhum, cria um com admin/admin
# (só funciona enquanto a senha padrão não foi trocada).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)" # pasta que contém os três repositórios
URL="${SONAR_URL:-http://localhost:9300}"
DOCKER_URL="${SONAR_DOCKER_URL:-http://host.docker.internal:9300}"
TOKEN_FILE="$HERE/.token"

token() {
  if [ -n "${SONAR_TOKEN:-}" ]; then echo "$SONAR_TOKEN"; return; fi
  if [ -s "$TOKEN_FILE" ]; then cat "$TOKEN_FILE"; return; fi
  local t
  t=$(curl -sf -u admin:admin -X POST "$URL/api/user_tokens/generate" -d "name=analyze-$(date +%s)" -d "type=GLOBAL_ANALYSIS_TOKEN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  [ -n "$t" ] || { echo "Sem token: defina SONAR_TOKEN (Minha conta → Segurança no SonarQube)." >&2; exit 1; }
  echo "$t" > "$TOKEN_FILE"
  echo "$t"
}

# chave do projeto → exclusões (o resto do sonar-project.properties de cada repo, se houver)
declare -A EXCLUDE=(
  [organizer]="node_modules/**,dist/**,out/**,test/ui/results/**,build/*.png,**/*.min.js"
  [bo-memory-server]="bin/**,**/*_test.go,docker/**"
  [bo-memory-web]="node_modules/**,test/shots/**"
)
declare -A TESTS=(
  [organizer]="test"
  [bo-memory-server]="."
  [bo-memory-web]="test"
)
declare -A TEST_INCLUSIONS=(
  [organizer]=""
  [bo-memory-server]="**/*_test.go"
  [bo-memory-web]=""
)

analyze() {
  local key="$1" dir="$ROOT/$1" tk="$2"
  [ -d "$dir" ] || { echo "pulado: $dir não existe"; return; }
  local args=(-Dsonar.projectKey="$key" -Dsonar.projectName="$key" -Dsonar.host.url="$DOCKER_URL" -Dsonar.token="$tk"
    -Dsonar.sources=. -Dsonar.exclusions="${EXCLUDE[$key]},${TESTS[$key]}/**" -Dsonar.scm.disabled=true -Dsonar.sourceEncoding=UTF-8)
  if [ "$key" = "bo-memory-server" ]; then
    args=(-Dsonar.projectKey="$key" -Dsonar.projectName="$key" -Dsonar.host.url="$DOCKER_URL" -Dsonar.token="$tk"
      -Dsonar.sources=. -Dsonar.exclusions="${EXCLUDE[$key]}" -Dsonar.tests=. -Dsonar.test.inclusions="${TEST_INCLUSIONS[$key]}"
      -Dsonar.scm.disabled=true -Dsonar.sourceEncoding=UTF-8)
  else
    args+=(-Dsonar.tests="${TESTS[$key]}")
  fi
  echo "▶ $key"
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(cygpath -w "$dir" 2>/dev/null || echo "$dir"):/usr/src" sonarsource/sonar-scanner-cli:latest "${args[@]}" -Dsonar.qualitygate.wait=false >/dev/null
}

ratings() {
  local key="$1" tk="$2"
  sleep 3
  for _ in $(seq 1 30); do
    curl -sf -u "$tk:" "$URL/api/ce/component?component=$key" | grep -q '"queue":\[\]' && break
    sleep 3
  done
  curl -sf -u "$tk:" "$URL/api/measures/component?component=$key&metricKeys=reliability_rating,security_rating,sqale_rating,security_review_rating,bugs,vulnerabilities,code_smells,security_hotspots,duplicated_lines_density" |
    node -e '
      const m = JSON.parse(require("fs").readFileSync(0, "utf8")).component.measures;
      const v = Object.fromEntries(m.map((x) => [x.metric, x.value]));
      const L = (r) => "?ABCDE"[Math.round(Number(r))] || "?";
      console.log(`  confiabilidade ${L(v.reliability_rating)} (${v.bugs} bugs) · segurança ${L(v.security_rating)} (${v.vulnerabilities} vuln.) · manutenibilidade ${L(v.sqale_rating)} (${v.code_smells} code smells) · revisão de segurança ${L(v.security_review_rating)} (${v.security_hotspots} hotspots) · duplicação ${v.duplicated_lines_density}%`);
    '
}

TK=$(token)
PROJECTS=("${@:-organizer bo-memory-server bo-memory-web}")
for p in ${PROJECTS[*]}; do
  analyze "$p" "$TK"
  ratings "$p" "$TK"
done
echo "Detalhes: $URL/projects"
