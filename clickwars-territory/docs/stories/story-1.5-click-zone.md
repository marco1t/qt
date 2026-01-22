# Story 1.5: Click Zone & Player Interaction

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.5  
**Priority:** 🔴 Critical  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.3, Story 1.4

---

## User Story

**As a** player,  
**I want** a clickable zone that registers my clicks and increments my team's gauge,  
**so that** I can contribute to my team's victory.

---

## Description

Implémenter la zone de clic interactive qui est le cœur du gameplay. Chaque clic dans cette zone doit incrémenter la jauge de l'équipe du joueur et son score personnel, avec un feedback visuel immédiat.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Une zone de clic large est affichée clairement (couleur de l'équipe du joueur) | ☐ |
| AC2 | Chaque clic dans la zone incrémente la jauge de l'équipe du joueur de 1 | ☐ |
| AC3 | Un feedback visuel immédiat confirme le clic (scale bounce ~100ms) | ☐ |
| AC4 | Le score personnel du joueur s'incrémente à chaque clic (si jauge < 100) | ☐ |
| AC5 | Les clics sont ignorés si la jauge de l'équipe est à 100 | ☐ |
| AC6 | Le compteur de score personnel est affiché ("Ton score: 42") | ☐ |
| AC7 | Tests unitaires vérifient la logique d'incrémentation | ☐ |

---

## Technical Notes

### Fichiers à créer/modifier

- `src/qml/components/ClickZone.qml` - Zone de clic
- `src/qml/screens/GameScreen.qml` - Intégrer la zone

### Composant ClickZone

```qml
// Propriétés
property color teamColor: "#E74C3C"
property bool enabled: true
property int clickCount: 0

// Signaux
signal clicked(real x, real y)

// Dimensions recommandées
width: Math.min(parent.width * 0.6, 300)
height: width  // Carré ou cercle
```

### Logique de clic

```qml
MouseArea {
    anchors.fill: parent
    enabled: clickZone.enabled
    
    onPressed: function(mouse) {
        // 1. Appeler GameState
        var success = GameState.incrementGauge(localPlayerTeam)
        
        if (success) {
            // 2. Incrémenter score local
            clickCount++
            
            // 3. Feedback visuel
            bounceAnimation.start()
            
            // 4. Émettre signal pour particules
            clickZone.clicked(mouse.x, mouse.y)
        }
    }
}
```

### Animation de rebond

```qml
SequentialAnimation {
    id: bounceAnimation
    
    NumberAnimation {
        target: clickZone
        property: "scale"
        to: 1.12
        duration: 50
        easing.type: Easing.OutQuad
    }
    NumberAnimation {
        target: clickZone
        property: "scale"
        to: 1.0
        duration: 80
        easing.type: Easing.InOutQuad
    }
}
```

### Affichage du score

```qml
Text {
    anchors.top: clickZone.bottom
    anchors.topMargin: 20
    text: "Ton score: " + clickZone.clickCount
    color: "white"
    font.pixelSize: 24
}
```

---

## Tests

```javascript
// Dans tst_gamelogic.qml
function test_clickIncrementsGauge() {
    GameState.resetGame()
    GameState.incrementGauge("A")
    compare(GameState.state.teamA.gauge, 1)
}

function test_clickIgnoredWhenFull() {
    GameState.resetGame()
    // Remplir la jauge
    for (var i = 0; i < 100; i++) {
        GameState.incrementGauge("A")
    }
    var result = GameState.incrementGauge("A")
    compare(result, false)
    compare(GameState.state.teamA.gauge, 100)
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les clics sont réactifs (pas de lag perceptible)
- [ ] L'animation de rebond est visible et satisfaisante
- [ ] Le score s'affiche et s'incrémente correctement
- [ ] Les clics après victoire sont ignorés

---

## Références

- [Architecture Section 5.2](/docs/architecture/game-architecture.md#52-clickzone-component)
- [PRD FR2, FR3, FR5](/docs/prd.md)
