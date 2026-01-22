# Story 3.3: Click Zone Feedback

**Epic:** Epic 3 - Visual Polish & Effects  
**Story ID:** 3.3  
**Priority:** 🟡 High  
**Estimation:** 2 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.5

---

## User Story

**As a** player,  
**I want** the click zone to react visually to my clicks,  
**so that** I feel connected to my actions.

---

## Description

Enrichir le feedback visuel de la zone de clic avec des animations de rebond, effet de ripple, et intensification de couleur.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | La zone de clic fait un scale bounce à chaque clic (1.0 → 1.12 → 1.0, ~100ms) | ☐ |
| AC2 | Un effet de ripple s'étend depuis le point de clic | ☐ |
| AC3 | La couleur de la zone s'intensifie brièvement au clic | ☐ |
| AC4 | Compteur de combo visible (optionnel, clics rapides) | ☐ |
| AC5 | Les effets sont performants (pas de lag) | ☐ |

---

## Technical Notes

### Amélioration de ClickZone.qml

```qml
import QtQuick

Rectangle {
    id: clickZone
    
    property color teamColor: "#E74C3C"
    property bool enabled: true
    property int comboCount: 0
    property real lastClickTime: 0
    
    signal clicked(real x, real y)
    
    width: 200
    height: 200
    radius: width / 2
    color: baseColor
    border.color: teamColor
    border.width: 4
    
    property color baseColor: Qt.lighter(teamColor, 1.3)
    property color pressedColor: Qt.lighter(teamColor, 1.6)
    
    // Animation de couleur
    Behavior on color {
        ColorAnimation { duration: 100 }
    }
    
    // Texte principal
    Column {
        anchors.centerIn: parent
        spacing: 4
        
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "CLIQUEZ!"
            color: "white"
            font.pixelSize: 24
            font.bold: true
        }
        
        // Compteur de combo
        Text {
            id: comboText
            anchors.horizontalCenter: parent.horizontalCenter
            text: comboCount > 2 ? "x" + comboCount : ""
            color: "#F1C40F"
            font.pixelSize: 20
            font.bold: true
            
            opacity: comboCount > 2 ? 1 : 0
            scale: comboCount > 2 ? 1 : 0.5
            
            Behavior on opacity { NumberAnimation { duration: 100 } }
            Behavior on scale { NumberAnimation { duration: 100 } }
        }
    }
    
    // Zone cliquable
    MouseArea {
        anchors.fill: parent
        enabled: clickZone.enabled
        
        onPressed: function(mouse) {
            // Mise à jour du combo
            var now = Date.now()
            if (now - lastClickTime < 500) {
                comboCount++
            } else {
                comboCount = 1
            }
            lastClickTime = now
            
            // Reset du combo après 500ms sans clic
            comboResetTimer.restart()
            
            // Feedback couleur
            clickZone.color = pressedColor
            colorResetTimer.start()
            
            // Animation de rebond
            bounceAnimation.start()
            
            // Effet ripple
            createRipple(mouse.x, mouse.y)
            
            // Émettre le signal
            clickZone.clicked(mouse.x, mouse.y)
        }
    }
    
    // Timer pour reset de couleur
    Timer {
        id: colorResetTimer
        interval: 100
        onTriggered: clickZone.color = baseColor
    }
    
    // Timer pour reset du combo
    Timer {
        id: comboResetTimer
        interval: 500
        onTriggered: comboCount = 0
    }
    
    // Animation de rebond
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
    
    // Container pour les ripples
    Item {
        id: rippleContainer
        anchors.fill: parent
        clip: true
    }
    
    // Composant Ripple
    Component {
        id: rippleComponent
        
        Rectangle {
            id: ripple
            
            property real centerX: 0
            property real centerY: 0
            
            x: centerX - width / 2
            y: centerY - height / 2
            width: 20
            height: 20
            radius: width / 2
            color: "transparent"
            border.color: "white"
            border.width: 2
            opacity: 1
            
            ParallelAnimation {
                running: true
                
                NumberAnimation {
                    target: ripple
                    property: "width"
                    to: clickZone.width * 1.5
                    duration: 400
                    easing.type: Easing.OutQuad
                }
                NumberAnimation {
                    target: ripple
                    property: "height"
                    to: clickZone.height * 1.5
                    duration: 400
                    easing.type: Easing.OutQuad
                }
                NumberAnimation {
                    target: ripple
                    property: "opacity"
                    to: 0
                    duration: 400
                }
                
                onFinished: ripple.destroy()
            }
        }
    }
    
    function createRipple(x, y) {
        rippleComponent.createObject(rippleContainer, {
            centerX: x,
            centerY: y
        })
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Le rebond est visible et satisfaisant
- [ ] L'effet ripple se propage correctement
- [ ] Le combo s'affiche à partir de 3 clics rapides
- [ ] Performances stables

---

## Références

- [Architecture Section 5.2](/docs/architecture/game-architecture.md#52-clickzone-component)
- [PRD FR27](/docs/prd.md)
