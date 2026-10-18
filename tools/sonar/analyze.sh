#!/usr/bin/env bash
# Analisa os três projetos no SonarQube local (tools/sonar/docker-compose.yml) e mostra as notas.
#   bash tools/sonar/analyze.sh                       # todos, com a cobertura que já estiver gerada
#   bash tools/sonar/analyze.sh --coverage            # roda os testes com cobertura antes (demora)
#   bash tools/sonar/analyze.sh organizer             # só um (organizer | bo-memory-server | bo-memory-web)
# Cobertura: organizer e web → coverage/lcov.info (npm run test:coverage); servidor → coverage.out
# (go test -coverprofile). Token: SONAR_TOKEN ou tools/sonar/.token (fora do git); sem nenhum, cria
# um com admin/admin (só enquanto a senha padrão não foi trocada).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)" # pasta que contém os três repositórios
URL="${SONAR_URL:-http://localhost:9300}"
DOCKER_URL="${SONAR_DOCKER_URL:-http://host.docker.internal:9300}"
TOKEN_FILE="$HERE/.token"

COVERAGE=0
PROJECTS=()
for a in "$@"; do
  if [ "$a" = "--coverage" ]; then COVERAGE=1; else PROJECTS+=("$a"); fi
done
[ ${#PROJECTS[@]} -gt 0 ] || PROJECTS=(organizer bo-memory-server bo-memory-web)

token() {
  if [ -n "${SONAR_TOKEN:-}" ]; then echo "$SONAR_TOKEN"; return; fi
  if [ -s "$TOKEN_FILE" ]; then cat "$TOKEN_FILE"; return; fi
  local t
  t=$(curl -sf -u admin:admin -X POST "$URL/api/user_tokens/generate" -d "name=analyze-$(date +%s)" -d "type=GLOBAL_ANALYSIS_TOKEN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  [ -n "$t" ] || { echo "Sem token: defina SONAR_TOKEN (Minha conta → Segurança no SonarQube)." >&2; exit 1; }
  echo "$t" > "$TOKEN_FILE"
  echo "$t"
}

# roda os testes com cobertura do projeto (gera o relatório que o scanner lê)
coverage() {
  local key="$1" dir="$ROOT/$1"
  echo "  testes com cobertura…"
  case "$key" in
    bo-memory-server) (cd "$dir" && go test ./... -p 1 -coverpkg=./... -coverprofile=coverage.out >/dev/null) ;;
    *) (cd "$dir" && npm run --silent test:coverage >/dev/null 2>&1) || echo "  (atenção: algum teste falhou; a cobertura saiu mesmo assim)" ;;
  esac
}

analyze() {
  local key="$1" dir="$ROOT/$1" tk="$2"
  [ -d "$dir" ] || { echo "pulado: $dir não existe"; return; }
  local args=(-Dsonar.projectKey="$key" -Dsonar.projectName="$key" -Dsonar.host.url="$DOCKER_URL" -Dsonar.token="$tk"
    -Dsonar.sources=. -Dsonar.scm.disabled=true -Dsonar.sourceEncoding=UTF-8)
  case "$key" in
    organizer)
      args+=(-Dsonar.exclusions="node_modules/**,dist/**,out/**,coverage/**,test/**,build/*.png,**/*.min.js" -Dsonar.tests=test
        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info) ;;
    bo-memory-web)
      args+=(-Dsonar.exclusions="node_modules/**,coverage/**,test/**" -Dsonar.tests=test -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info) ;;
    bo-memory-server)
      args+=(-Dsonar.exclusions="bin/**,**/*_test.go,docker/**,coverage.out" -Dsonar.tests=. -Dsonar.test.inclusions="**/*_test.go"
        -Dsonar.go.coverage.reportPaths=coverage.out -Dsonar.coverage.exclusions="cmd/**") ;;
  esac
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(cygpath -w "$dir" 2>/dev/null || echo "$dir"):/usr/src" sonarsource/sonar-scanner-cli:latest "${args[@]}" -Dsonar.qualitygate.wait=false >/dev/null
}

ratings() {
  local key="$1" tk="$2"
  sleep 3
  for _ in $(seq 1 30); do
    curl -sf -u "$tk:" "$URL/api/ce/component?component=$key" | grep -q '"queue":\[\]' && break
    sleep 3
  done
  curl -sf -u "$tk:" "$URL/api/measures/component?component=$key&metricKeys=reliability_rating,security_rating,sqale_rating,security_review_rating,bugs,vulnerabilities,code_smells,security_hotspots,coverage,duplicated_lines_density,alert_status" |
    node -e '
      const m = JSON.parse(require("fs").readFileSync(0, "utf8")).component.measures;
      const v = Object.fromEntries(m.map((x) => [x.metric, x.value]));
      const L = (r) => "?ABCDE"[Math.round(Number(r))] || "?";
      console.log(`  confiabilidade ${L(v.reliability_rating)} (${v.bugs} bugs) · segurança ${L(v.security_rating)} (${v.vulnerabilities} vuln.) · manutenibilidade ${L(v.sqale_rating)} (${v.code_smells} code smells) · revisão de segurança ${L(v.security_review_rating)} (${v.security_hotspots} hotspots)`);
      console.log(`  cobertura ${v.coverage ?? "—"}% · duplicação ${v.duplicated_lines_density}% · quality gate ${v.alert_status === "OK" ? "OK" : v.alert_status}`);
    '
}

TK=$(token)
for p in "${PROJECTS[@]}"; do
  echo "▶ $p"
  [ "$COVERAGE" = 1 ] && coverage "$p"
  analyze "$p" "$TK"
  ratings "$p" "$TK"
done
echo "Detalhes: $URL/projects"
