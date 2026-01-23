# Story 2.5: Player Disconnection Handling

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.5  
**Priority:** 🟡 High  
**Estimation:** 4 heures  
**Status:** ✅ Terminé (MVP - sans heartbeat, sans bot)  
**Date:** 2026-01-23  
**Dépend de:** Story 2.4

---

## User Story

**As a** player,  
**I want** the game to handle disconnections gracefully,  
**so that** one player leaving doesn't ruin the experience.

---

## Description

Gérer les cas de déconnexion de joueurs (volontaire ou perte de connexion). Le jeu doit continuer avec un bot remplaçant, sauf si l'hôte se déconnecte.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Quand un client se déconnecte, le serveur détecte le timeout (3 secondes) | ⏸️ Reporté |
| AC2 | Le slot du joueur déconnecté est remplacé par un bot automatiquement | ⏸️ Reporté |
| AC3 | Les autres joueurs reçoivent une notification (message toast) | ✅ |
| AC4 | Si l'hôte se déconnecte, les clients retournent au menu avec message d'erreur | ✅ |
| AC5 | Le jeu continue sans interruption après remplacement par bot | ⏸️ Reporté |

---

## Technical Notes

### Scénarios de Déconnexion

| Scénario | Détection | Action |
|----------|-----------|--------|
| Client timeout | 3s sans heartbeat | Remplacer par bot, notifier |
| Client quitte volontairement | Message "leave" | Remplacer par bot, notifier |
| Hôte timeout/quitte | Connexion TCP fermée | Tous → Menu avec erreur |
| Partie en cours | Durant gameplay | Bot prend la suite immédiatement |
| Dans le lobby | Avant démarrage | Slot devient vide ou bot |

### Système de Heartbeat

```javascript
// Client envoie un heartbeat toutes les secondes
var heartbeatTimer = Qt.setInterval(function() {
    Network.sendToServer({ type: "heartbeat" });
}, 1000);

// Serveur vérifie les heartbeats
var clientLastSeen = {}; // playerId -> timestamp

function updateHeartbeat(playerId) {
    clientLastSeen[playerId] = Date.now();
}

var checkTimer = Qt.setInterval(function() {
    var now = Date.now();
    for (var playerId in clientLastSeen) {
        if (now - clientLastSeen[playerId] > 3000) {
            handleClientTimeout(playerId);
        }
    }
}, 1000);
```

### Remplacement par Bot

```javascript
function handleClientDisconnect(playerId) {
    var player = getPlayerById(playerId);
    if (!player) return;
    
    // Créer un bot de remplacement
    var bot = BotManager.createBot(player.team, "normal");
    
    // Remplacer le joueur par le bot
    player.id = bot.id;
    player.name = "Bot (était " + player.name + ")";
    player.isBot = true;
    
    // Démarrer le bot si en partie
    if (GameState.state.phase === "playing") {
        BotManager.startBot(bot.id, function(team) {
            GameState.incrementGauge(team);
            broadcastStateUpdate();
        });
    }
    
    // Notifier les autres joueurs
    broadcastNotification({
        type: "player_left",
        message: player.name + " a quitté. Bot en remplacement.",
        playerId: playerId
    });
}
```

### Gestion Déconnexion Hôte

```javascript
// Côté client - détection déconnexion serveur
Network.onDisconnected.connect(function() {
    if (GameState.state.phase !== "menu") {
        // L'hôte est parti
        showError("L'hôte a quitté la partie.");
        navigateToMenu();
    }
});
```

### Composant Toast Notification

```qml
// components/ToastNotification.qml
Rectangle {
    id: toast
    
    property string message: ""
    property int duration: 3000
    
    visible: false
    width: parent.width * 0.8
    height: 50
    anchors.top: parent.top
    anchors.topMargin: 20
    anchors.horizontalCenter: parent.horizontalCenter
    
    color: "#2C3E50"
    radius: 8
    
    Text {
        anchors.centerIn: parent
        text: toast.message
        color: "white"
        font.pixelSize: 16
    }
    
    // Animation
    opacity: visible ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: 200 } }
    
    Timer {
        running: toast.visible
        interval: toast.duration
        onTriggered: toast.visible = false
    }
    
    function show(msg) {
        message = msg
        visible = true
    }
}
```

---

## Tests

```javascript
function test_clientTimeout() {
    // Setup serveur avec 2 clients
    var server = createServer()
    var client1 = createClient()
    var client2 = createClient()
    
    connectAll()
    startGame()
    
    // Simuler timeout de client1
    client1.stopHeartbeat()
    
    wait(3500) // 3s timeout + marge
    
    // Vérifier que client1 est remplacé par bot
    var players = server.getPlayers()
    var formerClient1 = players.find(p => p.team === client1.team)
    verify(formerClient1.isBot)
}

function test_hostDisconnect() {
    var server = createServer()
    var client = createClient()
    
    client.connect()
    startGame()
    
    // Arrêter le serveur
    server.stop()
    
    wait(500)
    
    // Client doit être au menu avec erreur
    compare(client.currentScreen, "menu")
    verify(client.lastError.includes("hôte"))
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les timeouts sont détectés correctement
- [ ] Les bots de remplacement fonctionnent
- [ ] Les notifications sont affichées
- [ ] La déconnexion hôte ramène tous les clients au menu

---

## Références

- [Architecture Section 6.3](/docs/architecture/game-architecture.md#63-network-error-handling)
- [PRD FR15](/docs/prd.md)
