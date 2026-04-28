# ClickWars Load Lab - Runbook DevOps

Ce runbook explique comment prouver que le système remplit son objectif principal : stresser des serveurs WebSocket temps réel et mesurer leur comportement sous charge.

## 1. Préparer L'Environnement

Depuis la racine du repo :

```bash
cd server
npm install
```

## 1 Bis. Validation Reproductible En Une Commande

Pour rejouer tout le pack de preuves automatiquement :

```bash
cd server
npm run validate:devops
```

Le script :

- vérifie la syntaxe des fichiers critiques ;
- lance les tests unitaires, multi-instance local, Redis, routing et anti-abus ;
- démarre deux instances WebSocket locales ;
- lance un stress clean puis un stress abus/latence/cas limites ;
- capture les métriques Prometheus des deux instances ;
- écrit les rapports dans `/tmp/clickwars-devops-*`.

Fichiers importants dans le dossier généré :

```text
summary.json
stress-clean.json
stress-abuse-latency-edge.json
session-routing.json
abuse-latency-edge.json
metrics-inst-a.prom
metrics-inst-b.prom
inst-a.log
inst-b.log
```

Si les ports par défaut sont occupés, utiliser :

```bash
GAME_PORT_A=17777 GAME_PORT_B=17778 \
DASHBOARD_PORT_A=13000 DASHBOARD_PORT_B=13001 \
npm run validate:devops
```

Démarrer Redis :

```bash
redis-server
```

Nettoyer l'état Redis avant une campagne :

```bash
redis-cli FLUSHALL
```

## 2. Démarrer Deux Instances

Terminal 1 :

```bash
cd server
REDIS_URL=redis://127.0.0.1:6379 \
GAME_PORT=7777 \
DASHBOARD_PORT=3000 \
INSTANCE_ID=inst-a \
node websocket-server.js
```

Terminal 2 :

```bash
cd server
REDIS_URL=redis://127.0.0.1:6379 \
GAME_PORT=7778 \
DASHBOARD_PORT=3001 \
INSTANCE_ID=inst-b \
node websocket-server.js
```

## 3. Vérifier Health Et Readiness

```bash
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/readyz
curl -fsS http://localhost:3001/healthz
curl -fsS http://localhost:3001/readyz
```

Résultat attendu :

```json
{"status":"ok","instanceId":"inst-a"}
{"status":"ready","instanceId":"inst-a"}
```

## 4. Lancer Une Campagne Smoke

```bash
cd server
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=smoke \
SESSION_ID=default \
REPORT_JSON=/tmp/clickwars-extreme-smoke.json \
node extreme-stress-test.js
```

Objectif : vérifier que le système fonctionne avant de monter en charge.

## 5. Monter En Charge

Campagne agressive :

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=aggressive \
REPORT_JSON=/tmp/clickwars-extreme-aggressive.json \
node extreme-stress-test.js
```

Campagne overload volontaire :

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=overload \
REPORT_JSON=/tmp/clickwars-extreme-overload.json \
node extreme-stress-test.js
```

Variables à ajuster si la machine locale est limitée :

```bash
CLIENTS=800 WORKERS=8 CLICK_HZ=30 PROFILE=aggressive node extreme-stress-test.js
```

## 6. Tester Une Session Explicite

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
SESSION_ID=devops-route-a \
PROFILE=smoke \
REPORT_JSON=/tmp/clickwars-session-explicit.json \
node extreme-stress-test.js
```

Ce test prouve que les clients peuvent être routés vers une session spécifique au lieu de la session legacy `default`.

## 7. Tester Persistance Et Routing

```bash
REDIS_URL=redis://127.0.0.1:6379 \
REPORT_JSON=/tmp/clickwars-session-routing-report.json \
node tests-session-routing.js
```

Ce rapport prouve :

- session `default` compatible ;
- session inconnue rejetée proprement ;
- sessions isolées ;
- récupération après perte d'instance ;
- même session jointe depuis deux instances ;
- joins concurrents sans double abonnement local.

## 8. Lire Les Preuves

Dans la sortie console du stress test, regarder :

```text
Connections ok
Connection failures
Peak connected
Clicks sent
Messages received
Reconnects
Duplicate messages
Sequence gaps
Durable divergence
Report
```

Critères attendus hors overload volontaire :

- `Connection failures = 0`
- `Duplicate messages = 0`
- `Sequence gaps = 0`
- `Durable divergence = 0`
- rapport JSON présent

Sous overload volontaire, les échecs sont acceptables seulement s'ils sont mesurés explicitement dans le rapport et dans `/metrics`.

## 9. Prouver Rate Limiting, Latence Et Cas Limites

Test déterministe local :

```bash
cd server
REPORT_JSON=/tmp/clickwars-abuse-latency-edge-report.json \
node tests-abuse-latency-edge.js
```

Ce rapport prouve :

- spam messages/clics/joins rejeté par connexion ;
- JSON invalide et payload trop gros mesurés ;
- `actionId` dupliqué rejeté avant modification du score ;
- reconnect storm sans perte d'équipe ni score ;
- leave/rejoin autour d'une victoire sans incohérence de session.

Campagne smoke avec réseau dégradé et trafic abusif :

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=smoke \
LATENCY_MS=80 \
JITTER_MS=40 \
PACKET_DELAY_PCT=25 \
PACKET_DROP_PCT=0 \
MALICIOUS_PCT=10 \
SPAM_HZ=120 \
DUPLICATE_ACTION_PCT=10 \
RAPID_JOIN_LEAVE_CYCLES=3 \
REPORT_JSON=/tmp/clickwars-789-smoke.json \
node extreme-stress-test.js
```

Dans le JSON, lire :

- `abusePrevention.rateLimitedMessages`
- `abusePrevention.maliciousMessagesSent`
- `abusePrevention.duplicateActionsSent`
- `latencySimulation.delayedMessages`
- `latencySimulation.averageInjectedDelayMs`
- `edgeCases.rapidJoinLeaveCycles`
- `edgeCases.reconnects`

Critères attendus :

- les messages abusifs produisent des `rate_limited` au lieu de crasher le serveur ;
- les clients non abusifs continuent à recevoir des `state_update` ;
- les paquets retardés sont comptabilisés ;
- `consistency.final.diverged = false` après la fenêtre de descente ;
- toute `Durable divergence` pendant le pic avec latence/jitter est un symptôme à analyser, pas un crash silencieux ;
- les cycles join/leave et reconnects restent mesurés.

## 10. Métriques À Capturer

```bash
curl -fsS http://localhost:3000/metrics > /tmp/metrics-inst-a.prom
curl -fsS http://localhost:3001/metrics > /tmp/metrics-inst-b.prom
```

Métriques importantes :

```text
clickwars_active_sessions
clickwars_connected_players
clickwars_messages_per_second
clickwars_messages_total
clickwars_clicks_total
clickwars_session_errors_total
clickwars_reconnect_attempts_total
clickwars_server_overloaded
clickwars_server_degraded
clickwars_rate_limited_total
clickwars_duplicate_actions_total
clickwars_abuse_disconnects_total
clickwars_invalid_json_total
clickwars_oversized_payloads_total
```

## 11. Arrêter Proprement

Arrêter chaque instance avec `Ctrl+C`.

Vérifier qu'il ne reste aucun process de test :

```bash
pgrep -fl "websocket-server.js|extreme-stress-test.js|tests-session-routing.js"
```

Si la commande ne retourne rien, la campagne est terminée proprement.
