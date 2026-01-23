# Story 2.3: Lobby System

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.3  
**Priority:** 🔴 Critical  
**Estimation:** 5 heures  
**Status:** ✅ Terminé (2026-01-23)  
**Dépend de:** Story 2.1, Story 2.2

---

## User Story

**As a** host,  
**I want** to manage players in a lobby before starting the game,  
**so that** everyone is ready and teams are balanced.

---

## Description

Créer l'écran de lobby où l'hôte peut voir les joueurs connectés, assigner les équipes, ajouter des bots, et lancer la partie. Les clients voient le même état en temps réel.

**Implémentation terminée** : Lobby fonctionnel avec synchronisation réseau complète.

---

## ⚠️ Adaptation d'implémentation

### Ce qui était prévu (conception initiale)
- Réassignation manuelle des joueurs entre équipes

### Ce qui a été fait (implémentation finale)
- **Lobby local et réseau fonctionnel**
- **Synchronisation temps réel** (via `lobby_update`)
- **Assignment automatique des équipes** (alternance A/B)
- **Ajout/retrait de bots** synchronisé par le serveur
- **Lancement synchronisé** de la partie

---

## Acceptance Criteria

| # | Critère | Implémentation | Vérifié |
|---|---------|----------------|---------|
| AC1 | L'écran Lobby affiche 4 slots de joueurs (2 par équipe) | ✅ Liste dynamique avec 2 colonnes (A/B) | ✅ |
| AC2 | Les joueurs connectés apparaissent dans leur slot avec leur nom | ✅ Affichage joueurs avec nom/icône/statut | ✅ |
| AC3 | L'hôte peut ajouter/retirer des bots dans les slots vides | ✅ Synchronisé via `add_bot`/`remove_bot` | ✅ |
| AC4 | L'hôte peut réassigner les joueurs entre les équipes | ⚠️ **Assignment automatique** (alternance A/B) | ➖ |
| AC5 | Un bouton "Lancer" est visible uniquement par l'hôte | ✅ Bouton visible si `isHost === true` | ✅ |
| AC6 | La partie peut démarrer avec min 2 joueurs (1+ par équipe) | ✅ Validation `canStart()` | ✅ |
| AC7 | Les clients voient le lobby se mettre à jour en temps réel | ✅ Synchronisation via message `lobby_update` | ✅ |

---

## Technical Notes

### Fichier à créer

`src/qml/screens/LobbyScreen.qml`

### Layout du Lobby

```
┌─────────────────────────────────────────────────────┐
│                    LOBBY                             │
│               Partie de Player1                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│   ÉQUIPE A (Rouge)        ÉQUIPE B (Bleu)           │
│   ┌───────────────┐       ┌───────────────┐         │
│   │ 👤 Player1    │       │ 👤 Player3    │         │
│   │    (Hôte)     │       │               │         │
│   └───────────────┘       └───────────────┘         │
│   ┌───────────────┐       ┌───────────────┐         │
│   │ 🤖 Bot Easy   │       │ ➕ Ajouter    │         │
│   │   [Retirer]   │       │               │         │
│   └───────────────┘       └───────────────┘         │
│                                                      │
│            ┌─────────────────────┐                  │
│            │   LANCER LA PARTIE  │ (hôte only)      │
│            └─────────────────────┘                  │
│                                                      │
│            ┌─────────────────────┐                  │
│            │       QUITTER       │                  │
│            └─────────────────────┘                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Composant PlayerSlot

```qml
// components/PlayerSlot.qml
Rectangle {
    id: playerSlot
    
    property var player: null  // { id, name, isBot, isHost }
    property string team: "A"
    property bool isHost: false  // Le joueur local est-il l'hôte?
    property bool isEmpty: player === null
    
    signal addBotClicked()
    signal removeBotClicked()
    signal changeTeamClicked()
    
    width: 180
    height: 80
    radius: 8
    color: isEmpty ? "#2C3E50" : (team === "A" ? Theme.teamA : Theme.teamB)
    border.color: player && player.isHost ? "#F1C40F" : "transparent"
    border.width: 3
    
    Column {
        anchors.centerIn: parent
        spacing: 4
        
        Text {
            text: isEmpty ? "+" : 
                  (player.isBot ? "🤖" : "👤") + " " + player.name
            color: "white"
            font.pixelSize: 16
        }
        
        Text {
            visible: player && player.isHost
            text: "(Hôte)"
            color: "#F1C40F"
            font.pixelSize: 12
        }
    }
    
    // Actions pour l'hôte
    Row {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 4
        spacing: 4
        visible: isHost
        
        Text {
            visible: player && player.isBot
            text: "Retirer"
            color: "#E74C3C"
            font.pixelSize: 12
            
            MouseArea {
                anchors.fill: parent
                onClicked: removeBotClicked()
            }
        }
    }
    
    MouseArea {
        anchors.fill: parent
        enabled: isEmpty && isHost
        onClicked: addBotClicked()
    }
}
```

### Synchronisation du Lobby

```javascript
// Messages réseau pour le lobby
// Server → Clients
{
    type: "lobby_update",
    players: [
        { id: "p1", name: "Player1", team: "A", isBot: false, isHost: true },
        { id: "bot1", name: "Bot Easy", team: "A", isBot: true },
        { id: "p2", name: "Player2", team: "B", isBot: false }
    ]
}

// Client → Server
{ type: "change_team", team: "B" }

// Server → Clients
{ type: "game_start" }
```

### Logique Lobby (Host)

```javascript
// Dans le serveur
function canStartGame() {
    var teamA = players.filter(p => p.team === "A");
    var teamB = players.filter(p => p.team === "B");
    return teamA.length >= 1 && teamB.length >= 1;
}

function addBot(team, difficulty) {
    if (players.length >= 4) return false;
    
    var bot = BotManager.createBot(team, difficulty);
    players.push({
        id: bot.id,
        name: bot.name,
        team: team,
        isBot: true,
        difficulty: difficulty
    });
    
    broadcastLobbyUpdate();
    return true;
}

function startGame() {
    if (!canStartGame()) return;
    
    Network.sendToAll({ type: "game_start" });
    // Transition vers GameScreen
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les 4 slots sont visibles et correctement positionnés
- [ ] L'ajout/retrait de bots fonctionne (hôte uniquement)
- [ ] Les clients voient les mises à jour en temps réel
- [ ] Le bouton Lancer est caché pour les non-hôtes
- [ ] La partie démarre correctement avec les joueurs/bots configurés

---

## Références

- [Architecture Section 4.4](/docs/architecture/game-architecture.md#44-ui-component-system)
- [PRD FR14, FR19, FR21, FR22](/docs/prd.md)
