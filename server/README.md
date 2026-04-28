# ClickWars Server & Stress Harness

Ce dossier contient le coeur utile du projet : un serveur WebSocket multi-instance et des simulateurs headless capables de stresser une application temps réel.

Le vocabulaire de jeu sert à générer une charge réaliste :

- joueurs = connexions WebSocket concurrentes ;
- clics = actions gameplay haute fréquence ;
- sessions = matches isolés par `sessionId` ;
- victoire/lobby/state updates = broadcasts d'état à valider.

Le client Qt/QML n'est pas requis pour lancer ni prouver les campagnes de charge.

## Démarrage

Installer :

```bash
npm install
```

Démarrer une instance simple :

```bash
npm start
```

Démarrer deux instances avec Redis :

```bash
REDIS_URL=redis://127.0.0.1:6379 GAME_PORT=7777 DASHBOARD_PORT=3000 INSTANCE_ID=inst-a node websocket-server.js
```

```bash
REDIS_URL=redis://127.0.0.1:6379 GAME_PORT=7778 DASHBOARD_PORT=3001 INSTANCE_ID=inst-b node websocket-server.js
```

## Endpoints DevOps

- `GET /healthz` : process vivant.
- `GET /readyz` : instance prête, Redis/default session initialisés.
- `GET /metrics` : métriques Prometheus.
- `GET /` : dashboard HTML historique.

Métriques importantes :

- `clickwars_active_sessions`
- `clickwars_sessions_created_total`
- `clickwars_sessions_restored_total`
- `clickwars_session_errors_total`
- `clickwars_reconnect_attempts_total`
- `clickwars_server_overloaded`
- `clickwars_server_degraded`
- `clickwars_messages_per_second`
- `clickwars_clicks_total`
- `clickwars_rate_limited_total{reason="..."}`
- `clickwars_duplicate_actions_total`
- `clickwars_abuse_disconnects_total`
- `clickwars_invalid_json_total`
- `clickwars_oversized_payloads_total`

## Stress Test Principal

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=smoke \
SESSION_ID=default \
REPORT_JSON=/tmp/clickwars-extreme-report.json \
node extreme-stress-test.js
```

Profils :

- `smoke` : validation rapide.
- `aggressive` : forte charge réaliste.
- `overload` : surcharge volontaire.

Variables utiles :

- `CLIENTS`
- `WORKERS`
- `RAMP_SEC`
- `PEAK_SEC`
- `DOWN_SEC`
- `CLICK_HZ`
- `BURST_SIZE`
- `RECONNECT_PCT`
- `RECONNECT_STORMS`
- `SESSION_ID`
- `REPORT_JSON`
- `LATENCY_MS`
- `JITTER_MS`
- `PACKET_DELAY_PCT`
- `PACKET_DROP_PCT`
- `MALICIOUS_PCT`
- `SPAM_HZ`
- `DUPLICATE_ACTION_PCT`
- `RAPID_JOIN_LEAVE_CYCLES`

Le rapport JSON contient les preuves principales : connexions réussies, échecs, pic connecté, clics envoyés, messages reçus, reconnexions, duplications, gaps de séquence et divergences durables.

Exemple avec latence, abus et cas limites :

```bash
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=smoke \
LATENCY_MS=80 \
JITTER_MS=40 \
PACKET_DELAY_PCT=25 \
MALICIOUS_PCT=10 \
SPAM_HZ=120 \
DUPLICATE_ACTION_PCT=10 \
RAPID_JOIN_LEAVE_CYCLES=3 \
REPORT_JSON=/tmp/clickwars-789-report.json \
node extreme-stress-test.js
```

Le rapport expose aussi `abusePrevention`, `latencySimulation` et `edgeCases`.

## Anti-Abus Serveur

Le serveur applique un rate limiting par connexion WebSocket. Variables principales :

- `RATE_LIMIT_ENABLED=false` pour le désactiver temporairement.
- `RATE_WINDOW_MS=1000`
- `RATE_MAX_MESSAGES=120`
- `RATE_MAX_CLICKS=80`
- `RATE_MAX_JOINS=5`
- `RATE_MAX_INVALID_JSON=10`
- `RATE_MAX_PAYLOAD_BYTES=4096`
- `RATE_CLOSE_ON_ABUSE=true` pour fermer les connexions abusives avec le code WebSocket `1008`.

Un rejet envoie :

```json
{"type":"rate_limited","code":"CLICK_RATE_LIMIT","retryAfterMs":500}
```

Codes possibles : `MESSAGE_RATE_LIMIT`, `CLICK_RATE_LIMIT`, `JOIN_RATE_LIMIT`, `PAYLOAD_TOO_LARGE`, `INVALID_JSON_RATE`, `DUPLICATE_ACTION`.

## Sessions Et Routage

Le serveur supporte un routage explicite par `sessionId`.

- `sessionId` absent : compatibilité legacy, session `default`.
- `create_session` : crée une session explicite.
- `player_join` avec `sessionId` : rejoint une session existante.
- `session_joined` : confirme la session, le joueur, l'instance et le statut restauré.
- `session_error` : retourne `SESSION_NOT_FOUND`, `SESSION_CLOSED`, `SESSION_FULL` ou `SERVER_OVERLOADED`.

Les snapshots Redis sont isolés par session avec des clés de type :

```text
clickwars:sessions:<sessionId>:state_snapshot
```

## Tests

Validation DevOps complète :

```bash
npm run validate:devops
```

Ce script exécute les régressions, démarre deux instances Node avec Redis, lance un stress clean, lance un stress abus/latence/cas limites, capture `/metrics`, puis écrit un `summary.json` dans `/tmp/clickwars-devops-*`.

Régressions obligatoires :

```bash
npm test
node tests-abuse-latency-edge.js
node tests-multi-instance-local.js
REDIS_URL=redis://127.0.0.1:6379 node tests-multi-instance.js
REDIS_URL=redis://127.0.0.1:6379 REPORT_JSON=/tmp/clickwars-session-routing-report.json node tests-session-routing.js
```

`tests-session-routing.js` prouve :

- compatibilité `default` ;
- erreur propre sur session inconnue ;
- isolation de deux sessions ;
- restauration d'une session après perte d'instance ;
- cohérence d'une session jointe depuis deux instances ;
- absence de double store local lors de joins concurrents.

`tests-abuse-latency-edge.js` prouve :

- rejet des payloads trop gros, JSON invalides et fréquences anormales ;
- rejet des `actionId` dupliqués avant mutation d'état ;
- isolation d'un client abusif par rapport aux autres ;
- reconnect storm avec conservation des équipes/scores ;
- leave/rejoin autour d'une victoire sans casser la session.

## Critères De Réussite

Une campagne est exploitable si :

- aucun crash serveur non géré ;
- rapport JSON généré ;
- `Duplicate messages = 0` ;
- `Sequence gaps = 0` hors déconnexions volontaires ;
- `Durable divergence = 0` ;
- `/readyz` reste OK sur les instances saines ;
- les erreurs sous surcharge sont mesurées explicitement.
