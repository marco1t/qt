# ClickWars Load Lab

ClickWars est maintenant positionné comme un outil de stress test pour serveurs temps réel WebSocket, pas comme un jeu destiné à être joué en production.

Le thème "jeu de clics multijoueur" sert de charge applicative réaliste : connexions concurrentes, actions haute fréquence, reconnexions, sessions persistantes, multi-instances Redis, métriques et rapports JSON. Le client Qt/QML existe encore comme démonstrateur historique, mais le livrable principal est le backend Node.js et les harnais de test headless.

## Objectif Du Repo

- Générer une charge WebSocket contrôlée et agressive.
- Valider le comportement multi-instance avec Redis.
- Mesurer les divergences d'état, duplications, trous de séquence et reconnexions.
- Produire des preuves exploitables par DevOps via `/metrics`, `/healthz`, `/readyz` et rapports JSON.
- Simuler des scénarios réalistes : surcharge, reconnexion massive, perte d'instance, routage de session.

## Stack Principale

- Node.js pour le serveur WebSocket autoritaire.
- Redis pour l'état partagé multi-instance et la persistance de session.
- `ws` + workers Node pour les clients simulés.
- Prometheus-compatible `/metrics` pour l'observabilité.

Qt/QML reste dans le repo pour contexte et démonstration visuelle, mais il n'est pas requis pour exécuter les tests de charge.

## Démarrage Rapide

Installer les dépendances serveur :

```bash
cd server
npm install
```

Démarrer Redis :

```bash
redis-server
```

Démarrer deux instances serveur :

```bash
cd server
REDIS_URL=redis://127.0.0.1:6379 GAME_PORT=7777 DASHBOARD_PORT=3000 INSTANCE_ID=inst-a node websocket-server.js
```

```bash
cd server
REDIS_URL=redis://127.0.0.1:6379 GAME_PORT=7778 DASHBOARD_PORT=3001 INSTANCE_ID=inst-b node websocket-server.js
```

Lancer un stress test headless :

```bash
cd server
SERVER_URLS=ws://localhost:7777,ws://localhost:7778 \
METRICS_URLS=http://localhost:3000/metrics,http://localhost:3001/metrics \
PROFILE=smoke \
SESSION_ID=default \
REPORT_JSON=/tmp/clickwars-stress-report.json \
node extreme-stress-test.js
```

## Preuves Attendues

Les sorties importantes pour DevOps sont :

- Rapport JSON du stress test : connexions, clics envoyés, reconnexions, duplications, gaps, divergences.
- `/metrics` : charge, sessions actives, erreurs de session, statut overloaded/degraded, compteurs de clics.
- `/healthz` : instance vivante.
- `/readyz` : instance prête à servir.
- Tests Redis multi-instance et session routing.

Runbook détaillé : [docs/STRESS_TEST_RUNBOOK.md](docs/STRESS_TEST_RUNBOOK.md)

Positionnement produit actuel : [docs/PROJECT_POSITIONING.md](docs/PROJECT_POSITIONING.md)

## Validations

Depuis `server/` :

```bash
npm test
node tests-multi-instance-local.js
REDIS_URL=redis://127.0.0.1:6379 node tests-multi-instance.js
REDIS_URL=redis://127.0.0.1:6379 REPORT_JSON=/tmp/clickwars-session-routing-report.json node tests-session-routing.js
```

## Structure Utile

```text
server/
  websocket-server.js          Serveur WebSocket + HTTP metrics/health
  GameServer.js                Logique de charge temps réel
  SharedStateStore.js          MemoryStore/RedisStore session-scopés
  SessionManager.js            Routage sessionId et isolation des sessions
  extreme-stress-test.js       Harnais de stress multi-worker
  tests-session-routing.js     Tests persistance, failure recovery, routing
  tests-multi-instance*.js     Régressions multi-instance

qml/
  Client Qt/QML historique pour démonstration visuelle uniquement

docs/
  Documentation et runbooks
```

## Statut Qt/QML

Le client Qt/QML n'est plus le chemin critique du projet. Il peut servir à visualiser une session, mais les objectifs réels sont validés par les scripts serveur et les rapports headless.

Si Qt/CMake n'est pas installé localement, cela ne bloque pas les campagnes de stress test.

Les anciennes docs orientées jeu sont conservées comme historique de conception. Elles ne remplacent pas le runbook de stress test ni le positionnement actuel.
