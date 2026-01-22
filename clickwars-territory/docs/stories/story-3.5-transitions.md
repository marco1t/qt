# Story 3.5: Screen Transitions

**Epic:** Epic 3 - Visual Polish & Effects  
**Story ID:** 3.5  
**Priority:** 🟢 Medium  
**Estimation:** 2 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.2

---

## User Story

**As a** player,  
**I want** smooth transitions between screens,  
**so that** navigation feels polished and professional.

---

## Description

Implémenter des transitions fluides entre les différents écrans de l'application (Menu, Lobby, Game, Victory) pour une expérience utilisateur premium.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Transitions fade/slide entre Menu → Lobby → Game → Victory | ☐ |
| AC2 | Durée des transitions: 300-500ms | ☐ |
| AC3 | Les transitions ne bloquent pas les inputs | ☐ |
| AC4 | Le loading affiche un indicateur si nécessaire | ☐ |
| AC5 | Pas de flash blanc ou artefacts visuels | ☐ |

---

## Technical Notes

### Navigation avec StackView

```qml
// main.qml
import QtQuick
import QtQuick.Controls
import Felgo

GameWindow {
    id: window
    
    StackView {
        id: navigator
        anchors.fill: parent
        
        initialItem: mainMenuScreen
        
        // Transitions personnalisées
        pushEnter: Transition {
            ParallelAnimation {
                PropertyAnimation {
                    property: "opacity"
                    from: 0
                    to: 1
                    duration: 300
                    easing.type: Easing.OutCubic
                }
                PropertyAnimation {
                    property: "x"
                    from: window.width * 0.3
                    to: 0
                    duration: 300
                    easing.type: Easing.OutCubic
                }
            }
        }
        
        pushExit: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 1
                to: 0
                duration: 300
                easing.type: Easing.OutCubic
            }
        }
        
        popEnter: Transition {
            ParallelAnimation {
                PropertyAnimation {
                    property: "opacity"
                    from: 0
                    to: 1
                    duration: 300
                    easing.type: Easing.OutCubic
                }
                PropertyAnimation {
                    property: "x"
                    from: -window.width * 0.3
                    to: 0
                    duration: 300
                    easing.type: Easing.OutCubic
                }
            }
        }
        
        popExit: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 1
                to: 0
                duration: 300
                easing.type: Easing.OutCubic
            }
        }
    }
    
    // Composants des écrans
    Component {
        id: mainMenuScreen
        MainMenuScreen {
            onNavigateTo: function(screen) {
                switch(screen) {
                    case "lobby":
                        navigator.push(lobbyScreen)
                        break
                    case "browser":
                        navigator.push(serverBrowserScreen)
                        break
                }
            }
        }
    }
    
    Component {
        id: lobbyScreen
        LobbyScreen {
            onNavigateTo: navigateTo
            onBack: navigator.pop()
        }
    }
    
    Component {
        id: gameScreen
        GameScreen {
            onNavigateTo: navigateTo
        }
    }
    
    Component {
        id: serverBrowserScreen
        ServerBrowserScreen {
            onBack: navigator.pop()
            onJoinGame: function(ip) {
                navigator.push(lobbyScreen, { serverIp: ip })
            }
        }
    }
    
    function navigateTo(screen) {
        switch(screen) {
            case "menu":
                navigator.pop(null)  // Retour au menu
                break
            case "game":
                navigator.push(gameScreen)
                break
            case "lobby":
                navigator.push(lobbyScreen)
                break
        }
    }
}
```

### Transition Alternative: Fade avec Overlay

```qml
// TransitionOverlay.qml
Rectangle {
    id: transitionOverlay
    anchors.fill: parent
    color: Theme.background
    opacity: 0
    visible: opacity > 0
    z: 1000  // Au-dessus de tout
    
    function fadeOut(callback) {
        fadeOutAnim.callback = callback
        fadeOutAnim.start()
    }
    
    function fadeIn() {
        fadeInAnim.start()
    }
    
    SequentialAnimation {
        id: fadeOutAnim
        property var callback: null
        
        NumberAnimation {
            target: transitionOverlay
            property: "opacity"
            to: 1
            duration: 200
        }
        
        ScriptAction {
            script: {
                if (fadeOutAnim.callback) {
                    fadeOutAnim.callback()
                }
                transitionOverlay.fadeIn()
            }
        }
    }
    
    NumberAnimation {
        id: fadeInAnim
        target: transitionOverlay
        property: "opacity"
        to: 0
        duration: 300
    }
}
```

### Utilisation du Transition Overlay

```qml
// Dans n'importe quel écran
AnimatedButton {
    text: "Créer Partie"
    onClicked: {
        transitionOverlay.fadeOut(function() {
            navigator.push(lobbyScreen)
        })
    }
}
```

### Loading Indicator (si nécessaire)

```qml
// LoadingIndicator.qml
Item {
    id: loader
    visible: false
    
    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, 0.7)
    }
    
    Column {
        anchors.centerIn: parent
        spacing: 20
        
        BusyIndicator {
            running: loader.visible
            width: 60
            height: 60
        }
        
        Text {
            text: "Chargement..."
            color: "white"
            font.pixelSize: 18
        }
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les transitions sont fluides (pas de saccade)
- [ ] Pas de flash blanc entre les écrans
- [ ] Navigation au clavier fonctionne
- [ ] Retour arrière fonctionne correctement

---

## Références

- [Architecture Section 4.4](/docs/architecture/game-architecture.md#44-ui-component-system)
- [Qt StackView Documentation](https://doc.qt.io/qt-6/qml-qtquick-controls-stackview.html)
