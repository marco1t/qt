# Story 4.1: Unit Test Coverage

**Epic:** Epic 4 - Testing & Hardening  
**Story ID:** 4.1  
**Priority:** 🟡 High  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.3, Story 1.6

---

## User Story

**As a** developer,  
**I want** comprehensive unit test coverage,  
**so that** the game logic is verified and regressions are caught.

---

## Description

Créer une suite de tests unitaires couvrant toute la logique métier : GameState, BotManager, GameLogic. Objectif de couverture > 70%.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Tests unitaires pour GameState (toutes les méthodes et edge cases) | ☐ |
| AC2 | Tests unitaires pour BotManager (timing, comportement) | ☐ |
| AC3 | Tests unitaires pour la logique de score | ☐ |
| AC4 | Couverture > 70% sur les fichiers JS/logique | ☐ |
| AC5 | Tous les tests passent via `make test` | ☐ |
| AC6 | Documentation des tests et leur objectif | ☐ |

---

## Technical Notes

### Structure des tests

```
tests/
├── unit/
│   ├── tst_gamestate.qml      # Tests GameState
│   ├── tst_botmanager.qml     # Tests BotManager
│   ├── tst_gamelogic.qml      # Tests logique du jeu
│   └── tst_utils.qml          # Tests utilitaires
└── tests.pro                   # Projet de tests
```

### Tests GameState

```javascript
// tests/unit/tst_gamestate.qml
import QtQuick
import QtTest
import "../../src/js/GameState.js" as GameState

TestCase {
    name: "GameStateTests"
    
    function init() {
        // Reset avant chaque test
        GameState.reset()
    }
    
    // ========== Tests État Initial ==========
    
    function test_initialState() {
        var state = GameState.getState()
        compare(state.teamA.gauge, 0, "Team A gauge should start at 0")
        compare(state.teamB.gauge, 0, "Team B gauge should start at 0")
        compare(state.phase, "menu", "Phase should start as 'menu'")
    }
    
    function test_initialConfig() {
        var state = GameState.getState()
        compare(state.config.maxGauge, 100, "Max gauge should be 100")
    }
    
    // ========== Tests Incrémentation ==========
    
    function test_incrementGaugeA() {
        var result = GameState.incrementGauge("A")
        verify(result === true, "Should return true for valid click")
        compare(GameState.getState().teamA.gauge, 1)
    }
    
    function test_incrementGaugeB() {
        GameState.incrementGauge("B")
        compare(GameState.getState().teamB.gauge, 1)
    }
    
    function test_multipleIncrements() {
        for (var i = 0; i < 10; i++) {
            GameState.incrementGauge("A")
        }
        compare(GameState.getState().teamA.gauge, 10)
    }
    
    function test_incrementInvalidTeam() {
        var result = GameState.incrementGauge("C")
        verify(result === false, "Invalid team should return false")
    }
    
    // ========== Tests Limite de Jauge ==========
    
    function test_gaugeCannotExceedMax() {
        for (var i = 0; i < 110; i++) {
            GameState.incrementGauge("A")
        }
        compare(GameState.getState().teamA.gauge, 100, "Gauge should not exceed 100")
    }
    
    function test_incrementReturnsFalseWhenFull() {
        for (var i = 0; i < 100; i++) {
            GameState.incrementGauge("A")
        }
        var result = GameState.incrementGauge("A")
        verify(result === false, "Should return false when gauge is full")
    }
    
    // ========== Tests Victoire ==========
    
    function test_victoryDetectionTeamA() {
        for (var i = 0; i < 100; i++) {
            GameState.incrementGauge("A")
        }
        compare(GameState.checkVictory(), "A")
    }
    
    function test_victoryDetectionTeamB() {
        for (var i = 0; i < 100; i++) {
            GameState.incrementGauge("B")
        }
        compare(GameState.checkVictory(), "B")
    }
    
    function test_noVictoryBeforeMax() {
        for (var i = 0; i < 99; i++) {
            GameState.incrementGauge("A")
        }
        compare(GameState.checkVictory(), null)
    }
    
    // ========== Tests Reset ==========
    
    function test_resetGame() {
        GameState.incrementGauge("A")
        GameState.incrementGauge("B")
        GameState.resetGame()
        
        var state = GameState.getState()
        compare(state.teamA.gauge, 0)
        compare(state.teamB.gauge, 0)
        compare(state.phase, "playing")
    }
    
    // ========== Tests Phase ==========
    
    function test_setPhase() {
        GameState.setPhase("lobby")
        compare(GameState.getState().phase, "lobby")
        
        GameState.setPhase("playing")
        compare(GameState.getState().phase, "playing")
    }
    
    // ========== Tests Joueurs ==========
    
    function test_addPlayer() {
        GameState.addPlayer({ id: "p1", name: "Test", team: "A" })
        var players = GameState.getState().teamA.players
        compare(players.length, 1)
        compare(players[0].name, "Test")
    }
    
    function test_removePlayer() {
        GameState.addPlayer({ id: "p1", name: "Test", team: "A" })
        GameState.removePlayer("p1")
        compare(GameState.getState().teamA.players.length, 0)
    }
    
    // ========== Tests Notifications ==========
    
    function test_subscribeReceivesNotifications() {
        var notified = false
        GameState.subscribe(function() {
            notified = true
        })
        
        GameState.incrementGauge("A")
        verify(notified, "Subscriber should be notified")
    }
}
```

### Tests BotManager

```javascript
// tests/unit/tst_botmanager.qml
import QtQuick
import QtTest
import "../../src/js/BotManager.js" as BotManager

TestCase {
    name: "BotManagerTests"
    
    function init() {
        BotManager.reset()
    }
    
    function test_createBot() {
        var bot = BotManager.createBot("A", "normal")
        verify(bot.id !== null, "Bot should have an ID")
        compare(bot.team, "A")
        compare(bot.difficulty, "normal")
        verify(bot.isActive === false, "Bot should not be active initially")
    }
    
    function test_createMultipleBots() {
        BotManager.createBot("A", "easy")
        BotManager.createBot("B", "hard")
        
        compare(BotManager.getAllBots().length, 2)
    }
    
    function test_startBot() {
        var bot = BotManager.createBot("A", "normal")
        BotManager.startBot(bot.id, function() {})
        
        verify(bot.isActive, "Bot should be active after start")
    }
    
    function test_stopBot() {
        var bot = BotManager.createBot("A", "normal")
        BotManager.startBot(bot.id, function() {})
        BotManager.stopBot(bot.id)
        
        verify(!bot.isActive, "Bot should not be active after stop")
    }
    
    function test_stopAllBots() {
        var bot1 = BotManager.createBot("A", "normal")
        var bot2 = BotManager.createBot("B", "hard")
        
        BotManager.startBot(bot1.id, function() {})
        BotManager.startBot(bot2.id, function() {})
        BotManager.stopAllBots()
        
        var active = BotManager.getActiveBots()
        compare(active.length, 0)
    }
    
    function test_removeBot() {
        var bot = BotManager.createBot("A", "normal")
        BotManager.removeBot(bot.id)
        
        compare(BotManager.getAllBots().length, 0)
    }
    
    function test_difficultyEasyInterval() {
        // Easy: 333-500ms = 2-3 clics/sec
        var config = BotManager.getDifficultyConfig("easy")
        compare(config.minInterval, 333)
        compare(config.maxInterval, 500)
    }
    
    function test_difficultyNormalInterval() {
        var config = BotManager.getDifficultyConfig("normal")
        compare(config.minInterval, 200)
        compare(config.maxInterval, 250)
    }
    
    function test_difficultyHardInterval() {
        var config = BotManager.getDifficultyConfig("hard")
        compare(config.minInterval, 125)
        compare(config.maxInterval, 167)
    }
    
    function test_botClicksAtCorrectRate() {
        var clicks = 0
        var bot = BotManager.createBot("A", "normal")
        
        BotManager.startBot(bot.id, function() {
            clicks++
        })
        
        wait(2100)  // 2 secondes + marge
        BotManager.stopBot(bot.id)
        
        // Normal = 4-5 clics/sec, donc 8-10 en 2s
        verify(clicks >= 7, "Should have at least 7 clicks (tolerance)")
        verify(clicks <= 12, "Should have at most 12 clicks (tolerance)")
    }
}
```

### Tests Logique de Score

```javascript
// tests/unit/tst_gamelogic.qml
import QtQuick
import QtTest
import "../../src/js/GameState.js" as GameState
import "../../src/js/GameLogic.js" as GameLogic

TestCase {
    name: "GameLogicTests"
    
    function init() {
        GameState.reset()
    }
    
    function test_scoreIncrementsWithClick() {
        var player = { id: "p1", name: "Test", team: "A", score: 0 }
        GameState.addPlayer(player)
        
        var result = GameLogic.processClick("p1")
        
        verify(result.success)
        compare(result.newScore, 1)
    }
    
    function test_scoreDoesNotIncrementWhenFull() {
        // Remplir la jauge A
        for (var i = 0; i < 100; i++) {
            GameState.incrementGauge("A")
        }
        
        var player = { id: "p1", name: "Test", team: "A", score: 50 }
        var result = GameLogic.processClick("p1")
        
        verify(!result.success)
        compare(result.newScore, 50)  // Inchangé
    }
    
    function test_totalScoreEqualsGauge() {
        var player1 = { id: "p1", team: "A", score: 0 }
        var player2 = { id: "p2", team: "A", score: 0 }
        
        GameState.addPlayer(player1)
        GameState.addPlayer(player2)
        
        // 10 clics chacun
        for (var i = 0; i < 10; i++) {
            GameLogic.processClick("p1")
            GameLogic.processClick("p2")
        }
        
        // Total des scores = jauge
        var totalScore = player1.score + player2.score
        compare(totalScore, GameState.getState().teamA.gauge)
    }
}
```

### Configuration Makefile pour les tests

```makefile
# Dans Makefile
test:
	@echo "Running unit tests..."
	@qmake6 tests/tests.pro -o build/tests/Makefile
	@cd build/tests && make
	@./build/tests/tst_all -v2
	@echo "Tests completed!"
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Min 20 tests unitaires créés
- [ ] Couverture > 70% vérifiée
- [ ] `make test` passe sans erreur
- [ ] Tests documentés (nom descriptif + assertions claires)

---

## Références

- [Architecture Section 9.1](/docs/architecture/game-architecture.md#91-unit-tests)
- [PRD NFR10](/docs/prd.md)
