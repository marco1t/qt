# Story 1.6: AI Bot System

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.6  
**Priority:** 🟡 High  
**Estimation:** 4 heures  
**Status:** ✅ Terminé (2026-01-22)  
**Dépend de:** Story 1.3 ✅

---

## User Story

**As a** player,  
**I want** bots to play for missing players,  
**so that** I can play even without 4 humans.

---

## Description

Implémenter le système de bots IA qui simulent des joueurs humains. Les bots cliquent automatiquement à des vitesses configurables selon leur niveau de difficulté.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Une classe/module `BotManager` simule des clics automatiques | ✅ |
| AC2 | Chaque bot a une vitesse de clic configurable (clics par seconde) | ✅ |
| AC3 | Trois niveaux de difficulté : Easy (2-3 cps), Normal (4-5 cps), Hard (6-8 cps) | ✅ |
| AC4 | Les bots démarrent/arrêtent avec le début/fin de partie | ✅ |
| AC5 | Les clics des bots incrémentent la jauge appropriée via GameState | ✅ |
| AC6 | Tests unitaires vérifient que les bots cliquent au bon rythme (±10% tolérance) | ⏳ |
| AC7 | Les bots peuvent être assignés à n'importe quelle équipe | ✅ |

---

## Technical Notes

### Fichier à créer

`src/js/BotManager.js`

### Configuration des difficultés

| Niveau | Clics/sec | Min Interval (ms) | Max Interval (ms) |
|--------|-----------|-------------------|-------------------|
| Easy | 2-3 | 333 | 500 |
| Normal | 4-5 | 200 | 250 |
| Hard | 6-8 | 125 | 167 |

### API Publique

```javascript
// Créer un bot
function createBot(team, difficulty)
// Returns: { id, name, team, difficulty, isActive }

// Contrôler les bots
function startBot(botId, clickCallback)
function stopBot(botId)
function stopAllBots()
function removeBot(botId)

// Queries
function getActiveBots()
function getBotsByTeam(team)
```

### Implémentation du timing

```javascript
function scheduleNextClick(bot, clickCallback) {
    if (!bot.isActive) return;
    
    var config = DIFFICULTY[bot.difficulty];
    // Intervalle aléatoire dans la plage
    var interval = config.minInterval + 
        Math.random() * (config.maxInterval - config.minInterval);
    
    bot.timerId = Qt.setTimeout(function() {
        if (bot.isActive) {
            clickCallback(bot.team, bot.id);
            scheduleNextClick(bot, clickCallback);
        }
    }, interval);
}
```

### Intégration avec GameScreen

```qml
// Dans GameScreen.qml
Component.onCompleted: {
    // Créer des bots pour les équipes
    var bot1 = BotManager.createBot("A", "normal")
    var bot2 = BotManager.createBot("B", "normal")
    var bot3 = BotManager.createBot("B", "easy")
    
    // Démarrer les bots avec callback
    BotManager.startBot(bot1.id, function(team, botId) {
        GameState.incrementGauge(team)
    })
}

Component.onDestruction: {
    BotManager.stopAllBots()
}
```

---

## Tests

```javascript
// tst_botmanager.qml
function test_createBot() {
    var bot = BotManager.createBot("A", "normal")
    verify(bot.id !== null)
    compare(bot.team, "A")
    compare(bot.difficulty, "normal")
}

function test_botClicksInRange() {
    // Mesurer le temps entre les clics
    var clicks = []
    var bot = BotManager.createBot("A", "normal")
    
    BotManager.startBot(bot.id, function() {
        clicks.push(Date.now())
    })
    
    wait(2000)  // Attendre 2 secondes
    BotManager.stopBot(bot.id)
    
    // Vérifier que le nombre de clics est dans la plage
    // Normal = 4-5 cps, donc 8-10 clics en 2s
    verify(clicks.length >= 7)  // 10% tolerance
    verify(clicks.length <= 11)
}

function test_stopBot() {
    var bot = BotManager.createBot("A", "easy")
    BotManager.startBot(bot.id, function() {})
    
    var active = BotManager.getActiveBots()
    compare(active.length, 1)
    
    BotManager.stopBot(bot.id)
    active = BotManager.getActiveBots()
    compare(active.length, 0)
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les bots cliquent de manière régulière mais avec variation naturelle
- [ ] Les trois niveaux de difficulté fonctionnent
- [ ] Les bots s'arrêtent proprement (pas de memory leaks)
- [ ] Tests passent avec tolérance ±10%

---

## Références

- [Architecture Section 4.3](/docs/architecture/game-architecture.md#43-bot-ai-system)
- [PRD FR16-FR19](/docs/prd.md)
