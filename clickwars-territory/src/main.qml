/**
 * ClickWars: Territory - Main QML Entry Point
 * 
 * Point d'entrée QML principal de l'application.
 * Configure la fenêtre de jeu et le système de navigation.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Window

// Import Felgo si disponible, sinon fallback Qt
// import Felgo  // Décommenter quand Felgo est configuré

import "qml/screens"
import "qml/styles"

ApplicationWindow {
    id: gameWindow
    
    // Configuration de la fenêtre
    visible: true
    width: 1280
    height: 720
    minimumWidth: 800
    minimumHeight: 600
    title: "ClickWars: Territory"
    
    // Couleur de fond
    color: Theme.background
    
    // Navigation avec StackView
    StackView {
        id: navigator
        anchors.fill: parent
        
        // Écran initial
        initialItem: mainMenuComponent
        
        // Transition d'entrée (push)
        pushEnter: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 0
                to: 1
                duration: 300
                easing.type: Easing.OutCubic
            }
        }
        
        // Transition de sortie (push)
        pushExit: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 1
                to: 0
                duration: 300
                easing.type: Easing.OutCubic
            }
        }
        
        // Transition d'entrée (pop/retour)
        popEnter: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 0
                to: 1
                duration: 300
                easing.type: Easing.OutCubic
            }
        }
        
        // Transition de sortie (pop/retour)
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
    
    // Composant Menu Principal
    Component {
        id: mainMenuComponent
        MainMenuScreen {
            onNavigateTo: function(screenName) {
                handleNavigation(screenName)
            }
        }
    }
    
    // Composant Lobby (placeholder)
    Component {
        id: lobbyComponent
        Rectangle {
            color: Theme.background
            
            Column {
                anchors.centerIn: parent
                spacing: 20
                
                Text {
                    text: "🎮 LOBBY"
                    color: "white"
                    font.pixelSize: 48
                    font.bold: true
                }
                
                Text {
                    text: "En construction..."
                    color: Theme.textSecondary
                    font.pixelSize: 24
                }
                
                Rectangle {
                    width: 200
                    height: 50
                    radius: 8
                    color: Theme.teamB
                    
                    Text {
                        anchors.centerIn: parent
                        text: "Retour"
                        color: "white"
                        font.pixelSize: 18
                    }
                    
                    MouseArea {
                        anchors.fill: parent
                        onClicked: navigator.pop()
                    }
                }
            }
        }
    }
    
    // Composant Server Browser (placeholder)
    Component {
        id: serverBrowserComponent
        Rectangle {
            color: Theme.background
            
            Column {
                anchors.centerIn: parent
                spacing: 20
                
                Text {
                    text: "🔍 RECHERCHE DE PARTIES"
                    color: "white"
                    font.pixelSize: 48
                    font.bold: true
                }
                
                Text {
                    text: "Recherche sur le réseau local..."
                    color: Theme.textSecondary
                    font.pixelSize: 24
                }
                
                Rectangle {
                    width: 200
                    height: 50
                    radius: 8
                    color: Theme.teamB
                    
                    Text {
                        anchors.centerIn: parent
                        text: "Retour"
                        color: "white"
                        font.pixelSize: 18
                    }
                    
                    MouseArea {
                        anchors.fill: parent
                        onClicked: navigator.pop()
                    }
                }
            }
        }
    }
    
    // Fonction de navigation
    function handleNavigation(screenName) {
        console.log("Navigation vers:", screenName)
        
        switch(screenName) {
            case "lobby":
                navigator.push(lobbyComponent)
                break
            case "browser":
                navigator.push(serverBrowserComponent)
                break
            case "menu":
                navigator.pop(null)  // Retour au menu
                break
            case "quit":
                Qt.quit()
                break
            default:
                console.warn("Écran inconnu:", screenName)
        }
    }
    
    // Debug: Afficher FPS en développement
    Text {
        id: debugInfo
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: 10
        color: "lime"
        font.pixelSize: 12
        text: "ClickWars v1.0"
        opacity: 0.5
        z: 1000
        
        // Cacher en production
        visible: true  // Mettre false pour release
    }
}
