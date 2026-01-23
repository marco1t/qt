# Story 3.1: Click Particle Effects

**Epic:** Epic 3 - Visual Polish & Effects  
**Story ID:** 3.1  
**Priority:** 🟡 High  
**Estimation:** 3 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.5

---

## User Story

**As a** player,  
**I want** to see particles burst when I click,  
**so that** each click feels impactful and satisfying.

---

## Description

Ajouter un système de particules qui génère une explosion de particules colorées à chaque clic. Les particules doivent être de la couleur de l'équipe et créer un effet visuel satisfaisant.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Un système de particules est implémenté | ☐ |
| AC2 | Chaque clic génère 10-20 particules de la couleur de l'équipe | ☐ |
| AC3 | Les particules s'éloignent du point de clic et disparaissent (~500ms) | ☐ |
| AC4 | L'effet ne dégrade pas les performances (60 FPS maintenu) | ☐ |
| AC5 | Les particules ont une légère variation de taille et vitesse | ☐ |
| AC6 | L'effet peut être désactivé (accessibilité) | ☐ |

---

## Technical Notes

### Fichier à créer

`src/qml/components/ParticleEffect.qml`

### Implémentation avec QtQuick.Particles

```qml
import QtQuick
import QtQuick.Particles

Item {
    id: particleEffect
    
    property color particleColor: "#E74C3C"
    property bool enabled: true
    
    anchors.fill: parent
    
    ParticleSystem {
        id: particleSystem
        running: particleEffect.enabled
    }
    
    Emitter {
        id: emitter
        system: particleSystem
        
        enabled: false  // Contrôlé manuellement via burst()
        
        lifeSpan: 500
        lifeSpanVariation: 100
        
        velocity: AngleDirection {
            angle: 0
            angleVariation: 360
            magnitude: 150
            magnitudeVariation: 50
        }
        
        acceleration: PointDirection {
            y: 100  // Légère gravité
        }
        
        size: 12
        sizeVariation: 4
        endSize: 0
    }
    
    ImageParticle {
        system: particleSystem
        source: "qrc:/assets/images/particle.png"  // Ou cercle simple
        color: particleEffect.particleColor
        colorVariation: 0.2
        alpha: 0.9
        alphaVariation: 0.1
    }
    
    // Fonction pour émettre une rafale
    function burst(x, y, count) {
        if (!enabled) return
        
        emitter.x = x
        emitter.y = y
        emitter.burst(count || 15)
    }
}
```

### Alternative sans QtQuick.Particles (plus simple)

```qml
// SimpleParticle.qml
Rectangle {
    id: particle
    
    property real targetX: 0
    property real targetY: 0
    property real speed: 1
    
    width: 10
    height: 10
    radius: 5
    color: "red"
    
    // Animation
    ParallelAnimation {
        id: moveAnim
        
        NumberAnimation {
            target: particle
            property: "x"
            to: particle.targetX
            duration: 500
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: particle
            property: "y"
            to: particle.targetY
            duration: 500
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: particle
            property: "opacity"
            from: 1
            to: 0
            duration: 500
        }
        NumberAnimation {
            target: particle
            property: "scale"
            from: 1
            to: 0.3
            duration: 500
        }
        
        onFinished: particle.destroy()
    }
    
    Component.onCompleted: moveAnim.start()
}

// ParticleEmitter.qml
Item {
    id: emitter
    
    property color particleColor: "red"
    property var particleComponent: null
    
    Component.onCompleted: {
        particleComponent = Qt.createComponent("SimpleParticle.qml")
    }
    
    function burst(x, y, count) {
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * 2 * Math.PI
            var distance = 50 + Math.random() * 100
            
            var particle = particleComponent.createObject(emitter, {
                x: x,
                y: y,
                targetX: x + Math.cos(angle) * distance,
                targetY: y + Math.sin(angle) * distance,
                color: particleColor
            })
        }
    }
}
```

### Intégration dans GameScreen

```qml
// GameScreen.qml
ParticleEffect {
    id: particles
    anchors.fill: parent
    particleColor: GameState.state.localPlayer.team === "A" ? 
                   Theme.teamA : Theme.teamB
    enabled: Settings.particlesEnabled  // Option accessibilité
}

ClickZone {
    onClicked: function(x, y) {
        // ... logique de clic ...
        particles.burst(clickZone.x + x, clickZone.y + y, 15)
    }
}
```

---

## Performance

- Maximum 100 particules simultanées
- Recycler les objets si nécessaire (object pooling)
- Tester sur machine de specs minimales

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Particules visibles et esthétiques
- [ ] Pas de drop de FPS même avec clics rapides
- [ ] Couleurs correspondent aux équipes
- [ ] Option pour désactiver fonctionne

---

## Références

- [Architecture Section 5.3](/docs/architecture/game-architecture.md#53-particleeffect-component)
- [PRD FR25](/docs/prd.md)
