#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${REPORT_DIR:-/tmp/clickwars-devops-$(date +%Y%m%d-%H%M%S)}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
GAME_PORT_A="${GAME_PORT_A:-7777}"
GAME_PORT_B="${GAME_PORT_B:-7778}"
DASHBOARD_PORT_A="${DASHBOARD_PORT_A:-3000}"
DASHBOARD_PORT_B="${DASHBOARD_PORT_B:-3001}"

PID_A=""
PID_B=""

log() {
    printf '[devops-validate] %s\n' "$*"
}

fail() {
    printf '[devops-validate] ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [[ -n "${PID_A}" ]]; then kill "${PID_A}" 2>/dev/null || true; fi
    if [[ -n "${PID_B}" ]]; then kill "${PID_B}" 2>/dev/null || true; fi
    if [[ -n "${PID_A}" ]]; then wait "${PID_A}" 2>/dev/null || true; fi
    if [[ -n "${PID_B}" ]]; then wait "${PID_B}" 2>/dev/null || true; fi
}
trap cleanup EXIT

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "commande manquante: $1"
}

assert_port_free() {
    local port="$1"
    if lsof -iTCP:"${port}" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        fail "port ${port} deja utilise. Change GAME_PORT_A/B ou DASHBOARD_PORT_A/B."
    fi
}

wait_ready() {
    local url="$1"
    local name="$2"
    for _ in $(seq 1 40); do
        if curl -fsS "${url}/readyz" >/dev/null 2>&1; then
            log "${name} ready: ${url}/readyz"
            return 0
        fi
        sleep 0.25
    done
    fail "${name} n'est pas ready. Voir ${REPORT_DIR}/${name}.log"
}

assert_report() {
    local report="$1"
    local mode="$2"
    node - "${report}" "${mode}" <<'NODE'
const fs = require('fs');
const [reportPath, mode] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const failures = [];
const stats = report.stats || {};
const consistency = report.consistency || {};
const final = consistency.final || {};
const abuse = report.abusePrevention || {};
const latency = report.latencySimulation || {};
const edge = report.edgeCases || {};

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert((stats.connectFailed || 0) === 0, 'connection failures must be 0');
assert((consistency.duplicateMessages || 0) === 0, 'duplicate messages must be 0');
assert((consistency.sequenceGaps || 0) === 0, 'sequence gaps must be 0');
assert(final.diverged === false, 'final state must not be divergent');

if (mode === 'abuse') {
  assert((abuse.rateLimitedMessages || 0) > 0, 'abuse run must receive rate_limited messages');
  assert((abuse.maliciousMessagesSent || 0) > 0, 'abuse run must send malicious messages');
  assert((abuse.duplicateActionsSent || 0) > 0, 'abuse run must send duplicate actions');
  assert((latency.delayedMessages || 0) > 0, 'latency run must delay messages');
  assert((edge.reconnects || 0) > 0, 'edge run must include reconnects');
}

if (failures.length > 0) {
  console.error(`${mode} report failed:`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`${mode} report ok: ${reportPath}`);
NODE
}

assert_metrics() {
    local metrics_a="${REPORT_DIR}/metrics-inst-a.prom"
    local metrics_b="${REPORT_DIR}/metrics-inst-b.prom"
    node - "${metrics_a}" "${metrics_b}" <<'NODE'
const fs = require('fs');
const bodies = process.argv.slice(2).map(path => fs.readFileSync(path, 'utf8')).join('\n');
const required = [
  'clickwars_rate_limiter_enabled',
  'clickwars_rate_limited_total',
  'clickwars_duplicate_actions_total',
  'clickwars_invalid_json_total',
  'clickwars_oversized_payloads_total'
];
const missing = required.filter(name => !bodies.includes(name));
if (missing.length > 0) {
  console.error(`missing metrics: ${missing.join(', ')}`);
  process.exit(1);
}
const rateLimited = [...bodies.matchAll(/clickwars_rate_limited_total\{[^}]*\}\s+(\d+(?:\.\d+)?)/g)]
  .reduce((sum, match) => sum + Number(match[1]), 0);
if (rateLimited <= 0) {
  console.error('rate limited metric did not increase');
  process.exit(1);
}
console.log(`metrics ok: rate_limited_total=${rateLimited}`);
NODE
}

main() {
    require_cmd node
    require_cmd npm
    require_cmd curl
    require_cmd redis-cli
    require_cmd lsof

    mkdir -p "${REPORT_DIR}"
    log "report dir: ${REPORT_DIR}"

    assert_port_free "${GAME_PORT_A}"
    assert_port_free "${GAME_PORT_B}"
    assert_port_free "${DASHBOARD_PORT_A}"
    assert_port_free "${DASHBOARD_PORT_B}"

    redis-cli -u "${REDIS_URL}" ping >/dev/null || fail "Redis indisponible sur ${REDIS_URL}"
    if [[ "${SKIP_REDIS_FLUSH:-0}" != "1" ]]; then
        log "flush Redis (${REDIS_URL})"
        redis-cli -u "${REDIS_URL}" FLUSHALL >/dev/null
    fi

    cd "${SERVER_DIR}"

    log "syntax checks"
    node --check websocket-server.js
    node --check extreme-stress-test.js
    node --check RateLimiter.js
    node --check tests-abuse-latency-edge.js

    log "regression tests"
    npm test
    REPORT_JSON="${REPORT_DIR}/abuse-latency-edge.json" node tests-abuse-latency-edge.js
    node tests-multi-instance-local.js
    REDIS_URL="${REDIS_URL}" node tests-multi-instance.js
    REDIS_URL="${REDIS_URL}" REPORT_JSON="${REPORT_DIR}/session-routing.json" node tests-session-routing.js

    log "start two WebSocket instances"
    REDIS_URL="${REDIS_URL}" GAME_PORT="${GAME_PORT_A}" DASHBOARD_PORT="${DASHBOARD_PORT_A}" INSTANCE_ID="devops-a" RATE_MAX_MESSAGES=60 RATE_MAX_CLICKS=40 node websocket-server.js >"${REPORT_DIR}/inst-a.log" 2>&1 &
    PID_A="$!"
    REDIS_URL="${REDIS_URL}" GAME_PORT="${GAME_PORT_B}" DASHBOARD_PORT="${DASHBOARD_PORT_B}" INSTANCE_ID="devops-b" RATE_MAX_MESSAGES=60 RATE_MAX_CLICKS=40 node websocket-server.js >"${REPORT_DIR}/inst-b.log" 2>&1 &
    PID_B="$!"

    wait_ready "http://localhost:${DASHBOARD_PORT_A}" "inst-a"
    wait_ready "http://localhost:${DASHBOARD_PORT_B}" "inst-b"

    log "clean multi-instance smoke"
    SERVER_URLS="ws://localhost:${GAME_PORT_A},ws://localhost:${GAME_PORT_B}" \
    METRICS_URLS="http://localhost:${DASHBOARD_PORT_A}/metrics,http://localhost:${DASHBOARD_PORT_B}/metrics" \
    PROFILE=smoke CLIENTS=8 WORKERS=2 RAMP_SEC=1 PEAK_SEC=2 DOWN_SEC=1 CLICK_HZ=3 BURST_SIZE=1 \
    RECONNECT_PCT=10 RECONNECT_STORMS=1 MAX_GAUGE=100000 STABLE_WINDOW_MS=4000 \
    REPORT_JSON="${REPORT_DIR}/stress-clean.json" \
    node extreme-stress-test.js
    assert_report "${REPORT_DIR}/stress-clean.json" clean

    log "abuse/latency/edge smoke"
    SERVER_URLS="ws://localhost:${GAME_PORT_A},ws://localhost:${GAME_PORT_B}" \
    METRICS_URLS="http://localhost:${DASHBOARD_PORT_A}/metrics,http://localhost:${DASHBOARD_PORT_B}/metrics" \
    PROFILE=smoke CLIENTS=12 WORKERS=2 RAMP_SEC=1 PEAK_SEC=3 DOWN_SEC=1 CLICK_HZ=5 BURST_SIZE=1 \
    RECONNECT_PCT=25 RECONNECT_STORMS=1 MAX_GAUGE=100000 STABLE_WINDOW_MS=4000 \
    LATENCY_MS=30 JITTER_MS=20 PACKET_DELAY_PCT=25 PACKET_DROP_PCT=0 \
    MALICIOUS_PCT=25 SPAM_HZ=100 DUPLICATE_ACTION_PCT=100 RAPID_JOIN_LEAVE_CYCLES=2 \
    REPORT_JSON="${REPORT_DIR}/stress-abuse-latency-edge.json" \
    node extreme-stress-test.js
    assert_report "${REPORT_DIR}/stress-abuse-latency-edge.json" abuse

    curl -fsS "http://localhost:${DASHBOARD_PORT_A}/metrics" > "${REPORT_DIR}/metrics-inst-a.prom"
    curl -fsS "http://localhost:${DASHBOARD_PORT_B}/metrics" > "${REPORT_DIR}/metrics-inst-b.prom"
    assert_metrics

    node - "${REPORT_DIR}" <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const clean = JSON.parse(fs.readFileSync(path.join(dir, 'stress-clean.json'), 'utf8'));
const abuse = JSON.parse(fs.readFileSync(path.join(dir, 'stress-abuse-latency-edge.json'), 'utf8'));
const summary = {
  generatedAt: new Date().toISOString(),
  reports: {
    cleanStress: path.join(dir, 'stress-clean.json'),
    abuseLatencyEdgeStress: path.join(dir, 'stress-abuse-latency-edge.json'),
    sessionRouting: path.join(dir, 'session-routing.json'),
    abuseLatencyEdgeTests: path.join(dir, 'abuse-latency-edge.json'),
    metricsInstA: path.join(dir, 'metrics-inst-a.prom'),
    metricsInstB: path.join(dir, 'metrics-inst-b.prom')
  },
  clean: {
    duplicateMessages: clean.consistency.duplicateMessages,
    sequenceGaps: clean.consistency.sequenceGaps,
    durableDivergences: clean.consistency.durableDivergences,
    finalDiverged: clean.consistency.final.diverged
  },
  abuseLatencyEdge: {
    rateLimitedMessages: abuse.abusePrevention.rateLimitedMessages,
    maliciousMessagesSent: abuse.abusePrevention.maliciousMessagesSent,
    duplicateActionsSent: abuse.abusePrevention.duplicateActionsSent,
    delayedMessages: abuse.latencySimulation.delayedMessages,
    reconnects: abuse.edgeCases.reconnects,
    rapidJoinLeaveCycles: abuse.edgeCases.rapidJoinLeaveCycles,
    finalDiverged: abuse.consistency.final.diverged
  }
};
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
NODE

    log "validation OK"
    log "preuves disponibles dans: ${REPORT_DIR}"
}

main "$@"
