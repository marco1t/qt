# Story 4.2: Performance Optimization

**Epic:** Epic 4 - Testing & Hardening  
**Story ID:** 4.2  
**Priority:** 🟡 High  
**Estimation:** 3 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 3.1, Story 3.4

---

## User Story

**As a** player,  
**I want** the game to run smoothly without lag,  
**so that** gameplay is responsive and enjoyable.

---

## Description

Profiler l'application, identifier les bottlenecks, et optimiser pour maintenir 60 FPS constants et une utilisation mémoire < 200MB.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Profiling de performance effectué (identifier bottlenecks) | ☐ |
| AC2 | 60 FPS maintenu avec 4 joueurs + particules au maximum | ☐ |
| AC3 | Mémoire RAM < 200MB en utilisation normale | ☐ |
| AC4 | Pas de memory leaks après 10 parties consécutives | ☐ |
| AC5 | Network bandwidth optimisé (pas de spam de messages) | ☐ |
| AC6 | Rapport de performance documenté | ☐ |

---

## Technical Notes

### Outils de Profiling

1. **FPS Monitor (intégré)**
```qml
// Ajouter dans main.qml pour le dev
Text {
    id: fpsCounter
    anchors.top: parent.top
    anchors.right: parent.right
    color: "lime"
    font.pixelSize: 14
    z: 9999
    
    property real fps: 0
    property int frameCount: 0
    property real lastTime: 0
    
    Timer {
        interval: 1000
        repeat: true
        running: true
        onTriggered: {
            parent.fps = parent.frameCount
            parent.frameCount = 0
        }
    }
    
    text: "FPS: " + fps
    
    // Incrémenter à chaque frame
    NumberAnimation on rotation {
        from: 0
        to: 0.001
        duration: 16
        loops: Animation.Infinite
        onRunningChanged: if (running) parent.frameCount++
    }
}
```

2. **Memory Monitor**
```qml
Text {
    id: memoryMonitor
    anchors.top: fpsCounter.bottom
    anchors.right: parent.right
    color: "cyan"
    font.pixelSize: 14
    z: 9999
    
    Timer {
        interval: 2000
        repeat: true
        running: true
        onTriggered: {
            // Note: Nécessite un binding C++ pour obtenir la mémoire réelle
            // Placeholder pour le moment
            parent.text = "Mem: ~XXX MB"
        }
    }
}
```

### Optimisations à Appliquer

#### 1. Particules

```qml
// Limiter le nombre de particules actives
ParticleSystem {
    // Maximum particles globalement
    maximumParticles: 100
}

// Recycler les particules au lieu de créer/détruire
Emitter {
    // Désactiver quand hors écran
    enabled: visible && Qt.application.active
}
```

#### 2. Animations

```qml
// Utiliser layer.enabled pour les éléments animés
Rectangle {
    layer.enabled: true  // Rasterise, réduit les redraws
    layer.smooth: true
    
    // Animation complexe ici
}

// Désactiver les animations hors écran
NumberAnimation {
    running: parent.visible && Qt.application.active
}
```

#### 3. Réseau

```javascript
// Throttle des updates (déjà dans Story 2.4)
var UPDATE_RATE = 30;  // Hz
var UPDATE_INTERVAL = 1000 / UPDATE_RATE;

// Batching des clics (si plusieurs clics très rapides)
var pendingClicks = 0;
var clickTimer = null;

function sendClick() {
    pendingClicks++;
    
    if (!clickTimer) {
        clickTimer = Qt.setTimeout(function() {
            Network.sendToServer({
                type: "clicks",
                count: pendingClicks
            });
            pendingClicks = 0;
            clickTimer = null;
        }, 50);  // Batch toutes les 50ms
    }
}
```

#### 4. Rendu

```qml
// Éviter les binding loops
property real cachedValue: computeExpensiveValue()

// Plutôt que
// width: computeExpensiveValue()  // Appelé à chaque frame!

// Utiliser Loader pour les éléments conditionnels
Loader {
    active: somethingNeeded
    sourceComponent: HeavyComponent {}
}

// Clip le contenu des listes longues
ListView {
    clip: true
    // Les éléments hors écran ne sont pas rendus
}
```

### Test de Stress

```qml
// Script de stress test
Item {
    id: stressTest
    
    property int gamesPlayed: 0
    
    function runStressTest() {
        console.log("Starting stress test...")
        
        // Simuler 10 parties complètes
        for (var game = 0; game < 10; game++) {
            // Reset
            GameState.resetGame()
            
            // Simuler des clics rapides
            for (var i = 0; i < 100; i++) {
                GameState.incrementGauge("A")
                // Créer des particules
                particles.burst(Math.random() * width, Math.random() * height, 15)
            }
            
            gamesPlayed++
        }
        
        console.log("Stress test complete: " + gamesPlayed + " games")
        // Vérifier la mémoire ici
    }
    
    Timer {
        interval: 100
        repeat: true
        running: stressTest.visible
        
        property int clicks: 0
        
        onTriggered: {
            // Simuler des clics continus
            GameState.incrementGauge(clicks % 2 === 0 ? "A" : "B")
            clicks++
        }
    }
}
```

### Rapport de Performance

Template du rapport à créer:

```markdown
# Performance Report - ClickWars: Territory

## Test Environment
- Device: [Model]
- OS: [Version]
- Qt Version: 6.8.3
- Felgo Version: 4.0

## Results

### Frame Rate
| Scenario | FPS Min | FPS Avg | FPS Max |
|----------|---------|---------|---------|
| Menu idle | XX | 60 | 60 |
| Gameplay (solo) | XX | XX | 60 |
| Gameplay (4 players) | XX | XX | 60 |
| Max particles | XX | XX | XX |

### Memory Usage
| Scenario | RAM (MB) |
|----------|----------|
| Startup | XX |
| Gameplay | XX |
| After 10 games | XX |
| Max observed | XX |

### Network
| Metric | Value |
|--------|-------|
| Avg message size | XX bytes |
| Messages/sec (idle) | XX |
| Messages/sec (active) | XX |
| Sync latency | XX ms |

## Bottlenecks Identified
1. [Issue] - [Solution]

## Optimizations Applied
1. [Optimization] - [Impact]

## Recommendations
- [Future optimization]
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] 60 FPS vérifié sur machine de specs minimales
- [ ] Mémoire < 200MB vérifié
- [ ] Pas de memory leak après 10 parties
- [ ] Rapport de performance créé

---

## Références

- [Architecture Section 7](/docs/architecture/game-architecture.md#7-performance-architecture)
- [PRD NFR1-NFR5](/docs/prd.md)
