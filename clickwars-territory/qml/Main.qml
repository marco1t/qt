/**
 * Main.qml - Point d'entrée QML principal
 *
 * Fenêtre principale de l'application ClickWars: Territory.
 * Configure la navigation et charge l'écran d'accueil.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "screens"
import "styles"
import "components"

ApplicationWindow {
    id: window

    // Configuration de la fenêtre
    visible: true
    width: 1280
    height: 720
    minimumWidth: 800
    minimumHeight: 600
    title: qsTr("ClickWars: Territory")
    color: Theme.background

    // Propriété pour exposer le gameState aux enfants
    property alias globalGameState: gameStateInstance

    // Gestionnaire d'état global
    GameStateManager {
        id: gameStateInstance

        onVictory: function (winner) {
            console.log("Victoire équipe:", winner);
        }
    }

    // Navigation avec StackView
    StackView {
        id: navigator
        anchors.fill: parent
        initialItem: mainMenuComponent

        // Transitions push
        pushEnter: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 0
                to: 1
                duration: 250
                easing.type: Easing.OutCubic
            }
        }
        pushExit: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 1
                to: 0
                duration: 250
                easing.type: Easing.OutCubic
            }
        }

        // Transitions pop
        popEnter: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 0
                to: 1
                duration: 250
                easing.type: Easing.OutCubic
            }
        }
        popExit: Transition {
            PropertyAnimation {
                property: "opacity"
                from: 1
                to: 0
                duration: 250
                easing.type: Easing.OutCubic
            }
        }
    }

    // Écran Menu Principal
    Component {
        id: mainMenuComponent
        MainMenuScreen {
            onNavigateTo: function (screenName) {
                handleNavigation(screenName);
            }
        }
    }

    // Écran de Jeu
    Component {
        id: gameComponent
        GameScreen {
            gameState: window.globalGameState
            onBackToMenu: {
                window.globalGameState.goToMenu();
                navigator.pop(null);
            }
        }
    }

    // Écran Lobby (démarre une partie de test)
    Component {
        id: lobbyComponent
        Rectangle {
            color: Theme.background

            Column {
                anchors.centerIn: parent
                spacing: 20

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "🎮 LOBBY"
                    color: "white"
                    font.pixelSize: 48
                    font.bold: true
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Prêt à jouer !"
                    color: Theme.textSecondary
                    font.pixelSize: 24
                }

                AnimatedButton {
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: 250
                    height: 60
                    text: "▶ Lancer la Partie"
                    buttonColor: Theme.success
                    onClicked: {
                        // Démarrer la partie
                        gameStateInstance.setLocalPlayer("local", "Joueur 1", "A", true);
                        gameStateInstance.startGame();
                        navigator.push(gameComponent);
                    }
                }

                AnimatedButton {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Retour"
                    buttonColor: Theme.buttonDefault
                    onClicked: navigator.pop()
                }
            }
        }
    }

    // Écran Recherche (placeholder)
    Component {
        id: browserComponent
        Rectangle {
            color: Theme.background

            Column {
                anchors.centerIn: parent
                spacing: 20

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "🔍 RECHERCHE DE PARTIES"
                    color: "white"
                    font.pixelSize: 36
                    font.bold: true
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Recherche sur le réseau local..."
                    color: Theme.textSecondary
                    font.pixelSize: 20
                }

                AnimatedButton {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Retour"
                    buttonColor: Theme.teamB
                    onClicked: navigator.pop()
                }
            }
        }
    }

    // Gestion de la navigation
    function handleNavigation(screenName) {
        console.log("Navigation vers:", screenName);
        switch (screenName) {
        case "lobby":
            navigator.push(lobbyComponent);
            break;
        case "browser":
            navigator.push(browserComponent);
            break;
        case "game":
            gameState.startGame();
            navigator.push(gameComponent);
            break;
        case "menu":
            navigator.pop(null);
            break;
        case "quit":
            Qt.quit();
            break;
        default:
            console.warn("Écran inconnu:", screenName);
        }
    }

    // Version en mode debug
    Text {
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: 10
        text: "v1.0.0"
        color: Qt.rgba(1, 1, 1, 0.3)
        font.pixelSize: 12
        z: 1000
    }
}
