# Story 1.3: Game State Manager

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.3  
**Priority:** 🔴 Critical  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.1

---

## User Story

**As a** developer,  
**I want** a central game state manager,  
**so that** all components can access and modify the game state consistently.

---

## Description

Créer le module JavaScript singleton `GameState.js` qui gère l'état global du jeu. Ce module est le cœur de la logique métier : il maintient les jauges, les scores, les joueurs, et notifie les composants QML des changements.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Un singleton `GameState` QML/JS gère l'état global du jeu | ☐ |
| AC2 | Les propriétés suivantes sont disponibles : `teamAGauge` (0-100), `teamBGauge` (0-100), `gamePhase` (menu/lobby/playing/victory), `players` (array) | ☐ |
| AC3 | Les propriétés sont observables (changements déclenchent des notifications) | ☐ |
| AC4 | Des méthodes `incrementGauge(team)`, `resetGame()`, `setPhase(phase)` existent | ☐ |
| AC5 | Tests unitaires vérifient le comportement du GameState (min 5 tests) | ☐ |
| AC6 | La logique de victoire détecte quand une jauge atteint 100 | ☐ |
| AC7 | `incrementGauge()` retourne `true` si le clic est valide, `false` si la jauge est pleine | ☐ |

---

## Technical Notes

### Fichier à créer

`src/js/GameState.js`

### Structure de l'état

```javascript
var state = {
    // Phase du jeu
    phase: "menu",  // menu | lobby | playing | victory
    
    // Jauges d'équipe
    teamA: {
        gauge: 0,
        players: []
    },
    teamB: {
        gauge: 0,
        players: []
    },
    
    // Joueur local
    localPlayer: {
        id: null,
        name: "Player",
        team: null,  // "A" ou "B"
        score: 0,
        isHost: false
    },
    
    // Configuration
    config: {
        maxGauge: 100,
        territoryName: "Territoire 1"
    }
};
```

### API Publique

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `getState()` | - | Object | Retourne l'état complet |
| `incrementGauge(team)` | "A" ou "B" | boolean | Incrémente la jauge, retourne si valide |
| `resetGame()` | - | void | Remet les jauges à 0 |
| `setPhase(phase)` | string | void | Change la phase du jeu |
| `checkVictory()` | - | "A"/"B"/null | Vérifie si une équipe a gagné |
| `addPlayer(player)` | Object | void | Ajoute un joueur |
| `removePlayer(id)` | string | void | Retire un joueur |
| `subscribe(callback)` | function | void | S'abonne aux changements |

### Tests requis

```javascript
// tests/unit/tst_gamestate.qml
function test_initialState()           // État initial correct
function test_incrementGauge()          // Incrémentation fonctionne
function test_gaugeMaxLimit()           // Ne dépasse pas 100
function test_victoryDetection()        // Détecte la victoire
function test_resetGame()               // Reset fonctionne
function test_incrementReturnsFalse()   // Retourne false si plein
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Le module est un singleton (`.pragma library`)
- [ ] Toutes les méthodes de l'API sont implémentées
- [ ] 6 tests unitaires passent
- [ ] La documentation inline est complète

---

## Références

- [Architecture Section 4.1](/docs/architecture/game-architecture.md#41-game-state-management-system)
- [PRD FR1-FR7](/docs/prd.md)
