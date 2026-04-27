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

Le rapport JSON contient les preuves principales : connexions réussies, échecs, pic connecté, clics envoyés, messages reçus, reconnexions, duplications, gaps de séquence et divergences durables.

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

Régressions obligatoires :

```bash
npm test
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

## Critères De Réussite

Une campagne est exploitable si :

- aucun crash serveur non géré ;
- rapport JSON généré ;
- `Duplicate messages = 0` ;
- `Sequence gaps = 0` hors déconnexions volontaires ;
- `Durable divergence = 0` ;
- `/readyz` reste OK sur les instances saines ;
- les erreurs sous surcharge sont mesurées explicitement.
