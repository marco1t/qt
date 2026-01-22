# Story 2.4: Game State Synchronization

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.4  
**Priority:** 🔴 Critical (Core Multiplayer)  
**Estimation:** 6 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 2.1, Story 2.3, Story 1.3

---

## User Story

**As a** player,  
**I want** to see the same gauge values as all other players,  
**so that** the game is fair and accurate.

---

## Description

Implémenter la synchronisation en temps réel de l'état du jeu entre le serveur (hôte) et tous les clients. Le serveur est l'autorité - il valide les clics et diffuse l'état à tous.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Le serveur maintient l'état autoritaire des jauges | ☐ |
| AC2 | Les clients envoient leurs clics au serveur | ☐ |
| AC3 | Le serveur valide et incrémente la jauge, puis broadcast l'état à tous | ☐ |
| AC4 | Les clients mettent à jour leur affichage à réception de l'état | ☐ |
| AC5 | La latence de synchronisation est < 50ms sur LAN | ☐ |
| AC6 | Les jauges sont identiques sur tous les écrans | ☐ |
| AC7 | Le serveur détecte la victoire et la broadcast à tous les clients | ☐ |

---

## Technical Notes

### Architecture de Synchronisation

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUX DE DONNÉES                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Client 2          Server (Host)           Client 3          │
│     │                   │                      │              │
│     │── click ─────────►│                      │              │
│     │                   │ validate()            │              │
│     │                   │ incrementGauge()      │              │
│     │                   │                      │              │
│     │◄── state_update ──│── state_update ─────►│              │
│     │                   │                      │              │
│  [update UI]            │               [update UI]           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Messages de Synchronisation

```javascript
// Client → Server
{
    type: "click",
    playerId: "p2",
    timestamp: 1706043600123
}

// Server → All Clients
{
    type: "state_update",
    teamAGauge: 45,
    teamBGauge: 38,
    players: [
        { id: "p1", name: "Player1", team: "A", score: 25 },
        { id: "p2", name: "Player2", team: "B", score: 20 }
    ],
    phase: "playing",
    timestamp: 1706043600150
}

// Server → All Clients (victoire)
{
    type: "victory",
    winner: "A",
    finalScores: [
        { id: "p1", name: "Player1", team: "A", score: 55 },
        { id: "p2", name: "Player2", team: "B", score: 45 }
    ]
}
```

### Logique Serveur

```javascript
// Dans NetworkManager.js ou GameServer.js

// Réception d'un clic client
function handleClientClick(clientId, message) {
    var player = getPlayerById(message.playerId);
    if (!player) return;
    
    // Valider le clic
    if (GameState.state[teamKey(player.team)].gauge >= 100) {
        return; // Jauge pleine, ignorer
    }
    
    // Incrémenter la jauge
    GameState.incrementGauge(player.team);
    
    // Incrémenter le score du joueur
    player.score++;
    
    // Vérifier victoire
    var winner = GameState.checkVictory();
    if (winner) {
        broadcastVictory(winner);
    } else {
        broadcastStateUpdate();
    }
}

// Broadcast throttlé (max 30/seconde)
var _lastBroadcast = 0;
var BROADCAST_INTERVAL = 33; // ~30 FPS

function broadcastStateUpdate() {
    var now = Date.now();
    if (now - _lastBroadcast < BROADCAST_INTERVAL) {
        // Planifier pour plus tard
        if (!_pendingBroadcast) {
            _pendingBroadcast = Qt.setTimeout(broadcastStateUpdate, BROADCAST_INTERVAL);
        }
        return;
    }
    
    _lastBroadcast = now;
    _pendingBroadcast = null;
    
    Network.sendToAll({
        type: "state_update",
        teamAGauge: GameState.state.teamA.gauge,
        teamBGauge: GameState.state.teamB.gauge,
        players: GameState.state.players,
        phase: GameState.state.phase,
        timestamp: now
    });
}
```

### Logique Client

```javascript
// Réception de state_update
function handleStateUpdate(message) {
    // Mettre à jour l'état local
    GameState.state.teamA.gauge = message.teamAGauge;
    GameState.state.teamB.gauge = message.teamBGauge;
    GameState.state.players = message.players;
    GameState.state.phase = message.phase;
    
    // Notifier l'UI
    GameState.notify();
}

// Envoi de clic
function sendClick() {
    Network.sendToServer({
        type: "click",
        playerId: GameState.state.localPlayer.id,
        timestamp: Date.now()
    });
    
    // Feedback local immédiat (optimistic update optionnel)
    // L'état réel viendra du serveur
}
```

### QML Integration

```qml
// Dans GameScreen.qml
Connections {
    target: Network
    
    function onMessageReceived(clientId, message) {
        if (message.type === "state_update") {
            gaugeA.value = message.teamAGauge
            gaugeB.value = message.teamBGauge
            updatePlayerScores(message.players)
        } else if (message.type === "victory") {
            showVictory(message.winner, message.finalScores)
        }
    }
}

// Clic local
ClickZone {
    onClicked: {
        if (Network.isConnected) {
            Network.sendClick()
        } else {
            // Mode local (sans réseau)
            GameState.incrementGauge(localTeam)
        }
    }
}
```

---

## Tests d'Intégration

```javascript
// tests/integration/tst_synchronization.qml
function test_gaugesSynchronized() {
    // Setup: 1 serveur, 2 clients
    var server = createServer()
    var client1 = createClient()
    var client2 = createClient()
    
    connectAll()
    startGame()
    
    // Simuler des clics
    client1.sendClick() // Team A
    client2.sendClick() // Team B
    
    wait(100) // Attendre la sync
    
    // Vérifier que tous ont le même état
    compare(server.getGaugeA(), 1)
    compare(client1.getGaugeA(), 1)
    compare(client2.getGaugeA(), 1)
    
    compare(server.getGaugeB(), 1)
    compare(client1.getGaugeB(), 1)
    compare(client2.getGaugeB(), 1)
}

function test_victoryBroadcast() {
    // Remplir la jauge A à 99
    for (var i = 0; i < 99; i++) {
        GameState.incrementGauge("A")
    }
    broadcastState()
    
    // Dernier clic
    client1.sendClick()
    wait(100)
    
    // Tous doivent recevoir la victoire
    compare(client1.victoryWinner, "A")
    compare(client2.victoryWinner, "A")
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les jauges sont parfaitement synchronisées
- [ ] Aucun clic n'est perdu (100% comptabilisés)
- [ ] La latence est acceptable (< 50ms sur LAN)
- [ ] La victoire est détectée et broadcast correctement
- [ ] Tests d'intégration passent

---

## Références

- [Architecture Section 6.2](/docs/architecture/game-architecture.md#62-state-synchronization-flow)
- [PRD FR12, FR13](/docs/prd.md)
- [PRD NFR2, NFR13](/docs/prd.md)
