# Story 1.7: Victory Detection & Screen

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.7  
**Priority:** 🔴 Critical  
**Estimation:** 3 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.4, Story 1.5, Story 1.6

---

## User Story

**As a** player,  
**I want** to see a victory screen when a team wins,  
**so that** I know the battle is over and can see the results.

---

## Description

Implémenter la détection de victoire et l'écran de fin de bataille. Quand une jauge atteint 100, le jeu passe en mode victoire, affiche l'équipe gagnante, et propose de rejouer.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Quand une jauge atteint 100, le jeu passe en phase "victory" | ☐ |
| AC2 | Un écran/overlay de victoire s'affiche avec l'équipe gagnante mise en avant | ☐ |
| AC3 | Les scores finaux de tous les joueurs sont affichés | ☐ |
| AC4 | Un bouton "Rejouer" réinitialise les jauges et relance une bataille | ☐ |
| AC5 | Un bouton "Menu Principal" retourne à l'écran d'accueil | ☐ |
| AC6 | Une animation de victoire basique est jouée (flash couleur équipe gagnante) | ☐ |
| AC7 | Le GameState est correctement réinitialisé pour une nouvelle partie | ☐ |

---

## Technical Notes

### Fichiers à créer

- `src/qml/overlays/VictoryOverlay.qml` - Overlay de victoire

### Layout de l'overlay

```
┌────────────────────────────────────────┐
│                                        │
│                                        │
│           🏆 VICTOIRE! 🏆              │
│                                        │
│          ÉQUIPE A GAGNE!               │
│                                        │
│    ─────────────────────────────       │
│    Scores:                             │
│    • Player1 (A): 42 pts               │
│    • Bot1 (A): 35 pts                  │
│    • Bot2 (B): 28 pts                  │
│    • Bot3 (B): 22 pts                  │
│    ─────────────────────────────       │
│                                        │
│      ┌──────────────────────┐          │
│      │      Rejouer         │          │
│      └──────────────────────┘          │
│                                        │
│      ┌──────────────────────┐          │
│      │   Menu Principal     │          │
│      └──────────────────────┘          │
│                                        │
└────────────────────────────────────────┘
```

### Détection de victoire

```qml
// Dans GameScreen.qml ou GameState observer
Connections {
    target: gameStateNotifier
    
    function onStateChanged() {
        var winner = GameState.checkVictory()
        if (winner) {
            showVictoryOverlay(winner)
        }
    }
}

function showVictoryOverlay(winner) {
    // Arrêter les bots
    BotManager.stopAllBots()
    
    // Changer la phase
    GameState.setPhase("victory")
    
    // Afficher l'overlay
    victoryOverlay.winner = winner
    victoryOverlay.visible = true
}
```

### Composant VictoryOverlay

```qml
// VictoryOverlay.qml
Rectangle {
    id: overlay
    
    property string winner: "A"
    property var scores: []
    
    visible: false
    anchors.fill: parent
    color: Qt.rgba(0, 0, 0, 0.8)  // Fond semi-transparent
    
    // Animation d'entrée
    opacity: visible ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: 300 } }
    
    // Contenu centré
    Column {
        anchors.centerIn: parent
        spacing: 20
        
        Text {
            text: "🏆 VICTOIRE! 🏆"
            color: winner === "A" ? Theme.teamA : Theme.teamB
            font.pixelSize: 48
            font.bold: true
        }
        
        Text {
            text: "Équipe " + winner + " gagne!"
            color: "white"
            font.pixelSize: 32
        }
        
        // Liste des scores
        Column {
            Repeater {
                model: overlay.scores
                Text {
                    text: modelData.name + ": " + modelData.score + " pts"
                    color: modelData.team === overlay.winner ? 
                           Theme.teamA : Theme.teamB
                }
            }
        }
        
        // Boutons
        AnimatedButton {
            text: "Rejouer"
            onClicked: {
                overlay.visible = false
                GameState.resetGame()
                startNewGame()
            }
        }
        
        AnimatedButton {
            text: "Menu Principal"
            onClicked: {
                overlay.visible = false
                navigateToMenu()
            }
        }
    }
}
```

### Animation de victoire simple

```qml
// Flash de couleur quand victoire détectée
Rectangle {
    id: victoryFlash
    anchors.fill: parent
    color: winner === "A" ? Theme.teamA : Theme.teamB
    opacity: 0
    
    SequentialAnimation {
        id: flashAnimation
        NumberAnimation { target: victoryFlash; property: "opacity"; to: 0.5; duration: 100 }
        NumberAnimation { target: victoryFlash; property: "opacity"; to: 0; duration: 300 }
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] La victoire est détectée instantanément (pas de délai)
- [ ] L'overlay apparaît avec animation fluide
- [ ] Les boutons Rejouer et Menu fonctionnent
- [ ] Le reset du jeu remet bien les jauges à 0
- [ ] Les bots s'arrêtent à la victoire

---

## Références

- [PRD FR4](/docs/prd.md)
- [Architecture Section 4.1](/docs/architecture/game-architecture.md#41-game-state-management-system)
