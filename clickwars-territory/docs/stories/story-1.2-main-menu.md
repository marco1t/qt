# Story 1.2: Main Menu Screen

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.2  
**Priority:** 🔴 Critical  
**Estimation:** 3 heures  
**Status:** ✅ Terminé (2026-01-22)  
**Dépend de:** Story 1.1 ✅

---

## User Story

**As a** player,  
**I want** to see a main menu when I launch the game,  
**so that** I can choose to create a game, join a game, or quit.

---

## Description

Créer l'écran d'accueil du jeu avec le titre et les trois boutons principaux. Cet écran est le point d'entrée de l'application et doit refléter l'identité visuelle du jeu (couleurs vives, fond sombre, style moderne).

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | L'écran d'accueil affiche le titre "ClickWars: Territory" avec un style attrayant | ✅ |
| AC2 | Trois boutons sont visibles : "Créer Partie", "Rejoindre Partie", "Quitter" | ✅ |
| AC3 | Le bouton "Quitter" ferme l'application | ✅ |
| AC4 | Le bouton "Créer Partie" navigue vers l'écran de Lobby (placeholder pour l'instant) | ✅ |
| AC5 | Le bouton "Rejoindre Partie" navigue vers l'écran de recherche (placeholder) | ✅ |
| AC6 | Le design respecte la palette de couleurs (fond #1A1A2E, texte blanc, boutons colorés) | ✅ |
| AC7 | Les boutons ont des effets hover/press visibles (changement de couleur ou scale) | ✅ |

---

## Technical Notes

### Fichiers à créer/modifier

- `src/qml/screens/MainMenuScreen.qml` - Écran principal
- `src/qml/components/AnimatedButton.qml` - Bouton réutilisable avec animations
- `src/main.qml` - Intégrer la navigation

### Design Specs

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│      ⚔️ CLICKWARS: TERRITORY ⚔️     │
│                                     │
│                                     │
│      ┌─────────────────────┐        │
│      │   Créer Partie      │        │
│      └─────────────────────┘        │
│                                     │
│      ┌─────────────────────┐        │
│      │  Rejoindre Partie   │        │
│      └─────────────────────┘        │
│                                     │
│      ┌─────────────────────┐        │
│      │      Quitter        │        │
│      └─────────────────────┘        │
│                                     │
└─────────────────────────────────────┘
```

### Palette de couleurs

| Élément | Couleur |
|---------|---------|
| Fond | #1A1A2E |
| Titre | #FFFFFF avec gradient optionnel |
| Bouton 1 | #E74C3C (rouge) |
| Bouton 2 | #3498DB (bleu) |
| Bouton 3 | #7F8C8D (gris) |

### Code de référence

```qml
// AnimatedButton.qml pattern
Rectangle {
    id: button
    property string text: "Button"
    property color buttonColor: "#E74C3C"
    
    signal clicked()
    
    color: mouseArea.pressed ? Qt.darker(buttonColor, 1.2) : 
           mouseArea.containsMouse ? Qt.lighter(buttonColor, 1.1) : 
           buttonColor
    
    Behavior on color { ColorAnimation { duration: 100 } }
    Behavior on scale { NumberAnimation { duration: 100 } }
    
    scale: mouseArea.pressed ? 0.95 : 1.0
    
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        hoverEnabled: true
        onClicked: button.clicked()
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] L'écran s'affiche correctement au lancement
- [ ] Les trois boutons sont fonctionnels
- [ ] Les animations de boutons sont fluides
- [ ] Le design correspond aux specs visuelles

---

## Références

- [PRD FR20-FR22](/docs/prd.md)
- [Architecture UI System](/docs/architecture/game-architecture.md#44-ui-component-system)
- [Game Brief - Art Direction](/docs/design/game-brief.md)
