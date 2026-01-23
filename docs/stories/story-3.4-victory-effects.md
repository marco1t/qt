# Story 3.4: Victory Celebration Effects

**Epic:** Epic 3 - Visual Polish & Effects  
**Story ID:** 3.4  
**Priority:** 🟡 High  
**Estimation:** 3 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.7

---

## User Story

**As a** player,  
**I want** an epic victory celebration,  
**so that** winning feels rewarding and memorable.

---

## Description

Créer une célébration de victoire spectaculaire avec explosion de particules, animations de texte, flash de couleur et effet de confetti.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Une explosion de particules de la couleur gagnante remplit l'écran | ☐ |
| AC2 | Le texte "VICTOIRE!" apparaît avec animation (scale + fade in) | ☐ |
| AC3 | Un flash de couleur overlay l'écran brièvement | ☐ |
| AC4 | Les jauges font une animation finale | ☐ |
| AC5 | Une animation de confetti tombe pendant 2-3 secondes | ☐ |

---

## Technical Notes

### Amélioration de VictoryOverlay.qml

```qml
import QtQuick
import QtQuick.Particles

Rectangle {
    id: victoryOverlay
    
    property string winner: "A"
    property var scores: []
    property color winnerColor: winner === "A" ? Theme.teamA : Theme.teamB
    
    visible: false
    anchors.fill: parent
    color: "transparent"
    
    // Fond semi-transparent avec animation
    Rectangle {
        id: backdrop
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, 0.8)
        opacity: 0
        
        Behavior on opacity {
            NumberAnimation { duration: 300 }
        }
    }
    
    // Flash de victoire
    Rectangle {
        id: victoryFlash
        anchors.fill: parent
        color: winnerColor
        opacity: 0
    }
    
    // Système de confetti
    ParticleSystem {
        id: confettiSystem
        running: victoryOverlay.visible
    }
    
    Emitter {
        id: confettiEmitter
        system: confettiSystem
        
        anchors.top: parent.top
        width: parent.width
        height: 50
        
        enabled: victoryOverlay.visible
        emitRate: 50
        lifeSpan: 3000
        lifeSpanVariation: 1000
        
        velocity: PointDirection {
            y: 150
            yVariation: 50
            x: 0
            xVariation: 50
        }
        
        acceleration: PointDirection {
            y: 50  // Gravité
        }
        
        size: 12
        sizeVariation: 6
        
        // Rotation pour effet réaliste
        rotation: 0
        rotationVariation: 180
        rotationVelocity: 180
        rotationVelocityVariation: 90
    }
    
    ImageParticle {
        system: confettiSystem
        source: "qrc:/assets/images/confetti.png"  // Ou forme simple
        colorVariation: 1  // Couleurs variées
        color: winnerColor
        alpha: 0.9
    }
    
    // Explosion centrale de particules
    ParticleSystem {
        id: explosionSystem
    }
    
    Emitter {
        id: explosionEmitter
        system: explosionSystem
        
        anchors.centerIn: parent
        enabled: false  // Déclenché manuellement
        
        lifeSpan: 800
        lifeSpanVariation: 200
        
        velocity: AngleDirection {
            angleVariation: 360
            magnitude: 300
            magnitudeVariation: 100
        }
        
        size: 20
        sizeVariation: 10
        endSize: 0
    }
    
    ImageParticle {
        system: explosionSystem
        source: "qrc:/assets/images/particle.png"
        color: winnerColor
        colorVariation: 0.3
    }
    
    // Contenu principal
    Column {
        id: content
        anchors.centerIn: parent
        spacing: 30
        scale: 0
        opacity: 0
        
        // Titre VICTOIRE
        Text {
            id: victoryTitle
            anchors.horizontalCenter: parent.horizontalCenter
            text: "🏆 VICTOIRE! 🏆"
            color: winnerColor
            font.pixelSize: 56
            font.bold: true
            
            // Pulsation
            SequentialAnimation on scale {
                running: victoryOverlay.visible
                loops: Animation.Infinite
                NumberAnimation { to: 1.05; duration: 500 }
                NumberAnimation { to: 1.0; duration: 500 }
            }
        }
        
        // Équipe gagnante
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Équipe " + victoryOverlay.winner + " gagne!"
            color: "white"
            font.pixelSize: 32
        }
        
        // Séparateur
        Rectangle {
            width: 300
            height: 2
            color: winnerColor
            anchors.horizontalCenter: parent.horizontalCenter
        }
        
        // Scores
        Column {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 8
            
            Text {
                text: "Scores Finaux"
                color: "#BDC3C7"
                font.pixelSize: 18
            }
            
            Repeater {
                model: victoryOverlay.scores
                
                Text {
                    text: (modelData.team === victoryOverlay.winner ? "⭐ " : "  ") +
                          modelData.name + ": " + modelData.score + " pts"
                    color: modelData.team === victoryOverlay.winner ? 
                           Qt.lighter(winnerColor, 1.3) : "#BDC3C7"
                    font.pixelSize: 20
                    font.bold: modelData.team === victoryOverlay.winner
                }
            }
        }
        
        // Boutons
        Row {
            spacing: 20
            anchors.horizontalCenter: parent.horizontalCenter
            
            AnimatedButton {
                text: "Rejouer"
                buttonColor: winnerColor
                onClicked: {
                    hide()
                    gameRestart()
                }
            }
            
            AnimatedButton {
                text: "Menu"
                buttonColor: "#7F8C8D"
                onClicked: {
                    hide()
                    navigateToMenu()
                }
            }
        }
    }
    
    // Animation d'entrée
    SequentialAnimation {
        id: showAnimation
        
        // Flash
        PropertyAnimation {
            target: victoryFlash
            property: "opacity"
            to: 0.7
            duration: 100
        }
        
        // Explosion de particules
        ScriptAction {
            script: explosionEmitter.burst(100)
        }
        
        PropertyAnimation {
            target: victoryFlash
            property: "opacity"
            to: 0
            duration: 300
        }
        
        // Backdrop
        PropertyAnimation {
            target: backdrop
            property: "opacity"
            to: 1
            duration: 200
        }
        
        // Contenu
        ParallelAnimation {
            PropertyAnimation {
                target: content
                property: "scale"
                from: 0.5
                to: 1
                duration: 400
                easing.type: Easing.OutBack
            }
            PropertyAnimation {
                target: content
                property: "opacity"
                to: 1
                duration: 300
            }
        }
    }
    
    function show(winningTeam, finalScores) {
        winner = winningTeam
        scores = finalScores
        visible = true
        showAnimation.start()
    }
    
    function hide() {
        visible = false
        content.scale = 0
        content.opacity = 0
        backdrop.opacity = 0
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] L'animation est fluide et impactante
- [ ] Le confetti tombe de manière réaliste
- [ ] Les boutons fonctionnent correctement
- [ ] L'effet ne ralentit pas l'application

---

## Références

- [PRD FR28](/docs/prd.md)
- [Game Brief - Art Direction](/docs/design/game-brief.md)
