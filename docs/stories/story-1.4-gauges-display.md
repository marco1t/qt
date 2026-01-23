# Story 1.4: Core Gameplay Screen - Gauges Display

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.4  
**Priority:** 🔴 Critical  
**Estimation:** 4 heures  
**Status:** ✅ Terminé (2026-01-22)  
**Dépend de:** Story 1.3 ✅

---

## User Story

**As a** player,  
**I want** to see the two team gauges prominently displayed,  
**so that** I can track the battle progress in real-time.

---

## Description

Créer l'écran de jeu principal avec les deux jauges d'équipe bien visibles. Les jauges doivent refléter l'état du GameState en temps réel et être animées de manière fluide.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | L'écran de jeu affiche deux jauges (Équipe A en haut/gauche, Équipe B en bas/droite) | ✅ |
| AC2 | Chaque jauge affiche sa valeur numérique (ex: "72/100") | ✅ |
| AC3 | Les jauges sont colorées selon l'équipe (rouge #E74C3C pour A, bleu #3498DB pour B) | ✅ |
| AC4 | Le remplissage des jauges est animé (transition fluide ~150-200ms) | ✅ |
| AC5 | Le nom du territoire actuel est affiché (texte "Territoire 1") | ✅ |
| AC6 | Les jauges se connectent au GameState et reflètent ses valeurs | ✅ |
| AC7 | Le label de chaque équipe est visible ("Équipe A", "Équipe B") | ✅ |

---

## Technical Notes

### Fichiers à créer

- `src/qml/screens/GameScreen.qml` - Écran de jeu principal
- `src/qml/components/GaugeBar.qml` - Composant jauge réutilisable

### Layout de l'écran

```
┌────────────────────────────────────────┐
│                                        │
│            Territoire 1                │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ÉQUIPE A          ████████░░ 72  │  │
│  └──────────────────────────────────┘  │
│                                        │
│               VS                       │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ÉQUIPE B          █████░░░░░ 45  │  │
│  └──────────────────────────────────┘  │
│                                        │
│          [Zone de clic ici]            │
│                                        │
└────────────────────────────────────────┘
```

### Composant GaugeBar

```qml
// Propriétés requises
property real value: 0          // Valeur actuelle (0-100)
property real maxValue: 100     // Valeur maximale
property color teamColor        // Couleur de l'équipe
property string teamName        // Nom de l'équipe
property bool showLabel: true   // Afficher le label

// Animation requise
Behavior on value {
    NumberAnimation {
        duration: 150
        easing.type: Easing.OutQuad
    }
}
```

### Connexion au GameState

```qml
// Dans GameScreen.qml
import "../js/GameState.js" as GameState

GaugeBar {
    id: gaugeA
    teamName: "Équipe A"
    teamColor: Theme.teamA
    value: GameState.state.teamA.gauge
    maxValue: GameState.state.config.maxGauge
}

// Écouter les changements
Connections {
    target: gameStateNotifier  // Objet qui émet les signaux
    function onStateChanged() {
        gaugeA.value = GameState.state.teamA.gauge
        gaugeB.value = GameState.state.teamB.gauge
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les jauges s'animent de façon fluide
- [ ] Les couleurs correspondent au thème
- [ ] Les valeurs numériques sont lisibles
- [ ] L'écran est responsive (s'adapte aux différentes tailles)

---

## Références

- [Architecture Section 5.1](/docs/architecture/game-architecture.md#51-gaugebar-component)
- [PRD FR1, FR2](/docs/prd.md)
- [Theme Configuration](/docs/architecture/game-architecture.md#81-theme-configuration)
