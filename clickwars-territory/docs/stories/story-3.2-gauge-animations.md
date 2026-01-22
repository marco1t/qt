# Story 3.2: Gauge Animation Enhancement

**Epic:** Epic 3 - Visual Polish & Effects  
**Story ID:** 3.2  
**Priority:** 🟡 High  
**Estimation:** 3 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.4

---

## User Story

**As a** player,  
**I want** gauges to animate smoothly and dynamically,  
**so that** progress feels alive and exciting.

---

## Description

Améliorer l'animation des jauges avec des effets visuels dynamiques : intensité croissante, pulsation en zone danger, et glow effects.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Les jauges utilisent une animation fluide (~150ms) | ☐ |
| AC2 | La couleur de la jauge devient plus intense proche de 100 | ☐ |
| AC3 | Une légère pulsation anime les jauges constamment | ☐ |
| AC4 | À 80%+, la jauge pulse plus rapidement (zone danger) | ☐ |
| AC5 | Un effet de glow renforce l'importance des jauges | ☐ |
| AC6 | Les animations sont synchronisées avec la valeur réseau | ☐ |

---

## Technical Notes

### Amélioration de GaugeBar.qml

```qml
import QtQuick
import QtQuick.Effects

Item {
    id: gaugeBar
    
    property real value: 0
    property real maxValue: 100
    property color teamColor: "#E74C3C"
    property string teamName: "Team A"
    
    // Propriétés calculées
    property real progress: value / maxValue
    property bool isDanger: progress >= 0.8
    property color intensifiedColor: Qt.lighter(teamColor, 1 + progress * 0.5)
    
    width: parent.width * 0.8
    height: 60
    
    // Fond avec glow
    Rectangle {
        id: background
        anchors.fill: parent
        color: "#2C3E50"
        radius: height / 2
        
        // Effet glow (optionnel, peut impacter performances)
        layer.enabled: true
        layer.effect: MultiEffect {
            shadowEnabled: true
            shadowColor: gaugeBar.teamColor
            shadowBlur: isDanger ? 1.0 : 0.3
            shadowOpacity: isDanger ? 0.8 : 0.4
        }
    }
    
    // Remplissage animé
    Rectangle {
        id: fill
        width: parent.width * gaugeBar.progress
        height: parent.height
        radius: parent.height / 2
        
        // Dégradé d'intensité
        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0.0; color: gaugeBar.teamColor }
            GradientStop { position: 1.0; color: gaugeBar.intensifiedColor }
        }
        
        // Animation de transition
        Behavior on width {
            NumberAnimation {
                duration: 150
                easing.type: Easing.OutQuad
            }
        }
        
        // Pulsation
        opacity: pulseOpacity
        property real pulseOpacity: 1.0
        
        SequentialAnimation {
            running: true
            loops: Animation.Infinite
            
            NumberAnimation {
                target: fill
                property: "pulseOpacity"
                to: gaugeBar.isDanger ? 0.7 : 0.9
                duration: gaugeBar.isDanger ? 150 : 500
                easing.type: Easing.InOutSine
            }
            NumberAnimation {
                target: fill
                property: "pulseOpacity"
                to: 1.0
                duration: gaugeBar.isDanger ? 150 : 500
                easing.type: Easing.InOutSine
            }
        }
    }
    
    // Texte du score
    Text {
        anchors.centerIn: parent
        text: Math.floor(gaugeBar.value) + "/" + Math.floor(gaugeBar.maxValue)
        color: "white"
        font.pixelSize: 24
        font.bold: true
        
        // Animation du texte en zone danger
        scale: fill.pulseOpacity
    }
    
    // Label équipe avec animation
    Text {
        id: teamLabel
        anchors.bottom: parent.top
        anchors.bottomMargin: 8
        anchors.horizontalCenter: parent.horizontalCenter
        text: gaugeBar.teamName.toUpperCase()
        color: gaugeBar.intensifiedColor
        font.pixelSize: 18
        font.bold: true
        font.letterSpacing: 2
    }
    
    // Indicateur de zone danger
    Rectangle {
        visible: gaugeBar.isDanger
        anchors.right: fill.right
        anchors.verticalCenter: fill.verticalCenter
        width: 4
        height: fill.height - 4
        radius: 2
        color: "white"
        
        SequentialAnimation on opacity {
            running: gaugeBar.isDanger
            loops: Animation.Infinite
            NumberAnimation { to: 0.3; duration: 100 }
            NumberAnimation { to: 1.0; duration: 100 }
        }
    }
}
```

### Effet de remplissage "liquide" (optionnel)

```qml
// Effet de vague dans le remplissage
ShaderEffect {
    id: waveEffect
    anchors.fill: fill
    
    property real time: 0
    property color fillColor: gaugeBar.teamColor
    
    NumberAnimation on time {
        from: 0
        to: 2 * Math.PI
        duration: 2000
        loops: Animation.Infinite
    }
    
    fragmentShader: "
        varying highp vec2 qt_TexCoord0;
        uniform lowp float qt_Opacity;
        uniform highp float time;
        uniform lowp vec4 fillColor;
        
        void main() {
            highp float wave = sin(qt_TexCoord0.x * 10.0 + time) * 0.02;
            highp float alpha = step(qt_TexCoord0.y, 0.5 + wave);
            gl_FragColor = fillColor * alpha * qt_Opacity;
        }
    "
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Animations fluides sans saccades
- [ ] Effets visuels de zone danger visibles
- [ ] Pas d'impact notable sur les performances
- [ ] Synchronisation avec données réseau

---

## Références

- [Architecture Section 5.1](/docs/architecture/game-architecture.md#51-gaugebar-component)
- [PRD FR26, FR29](/docs/prd.md)
