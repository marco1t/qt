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
    property alias globalNetwork: networkManager

    // Gestionnaire d'état global
    GameStateManager {
        id: gameStateInstance

        onVictory: function (winner) {
            console.log("Victoire équipe:", winner);
        }
    }

    // Gestionnaire réseau global
    NetworkManager {
        id: networkManager

        onConnected: {
            console.log("✅ Connecté au serveur !");
        }

        onDisconnected: {
            console.log("❌ Déconnecté du serveur");
        }

        onMessageReceived: function (senderId, message) {
            console.log("📨 Message de", senderId, ":", JSON.stringify(message));
        }

        onConnectionError: function (error) {
            console.error("⚠️ Erreur réseau:", error);
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

    // Écran Lobby
    Component {
        id: lobbyComponent
        LobbyScreen {
            isHost: true  // TODO: Déterminer si c'est l'hôte
            localPlayerId: window.globalNetwork.localPlayerId

            onBackToMenu: {
                navigator.pop();
            }

            onStartGame: function (players) {
                console.log("🚀 Lancement de la partie avec", players.length, "joueurs");

                // Créer GameScreen avec les joueurs
                var gameScreen = gameComponent.createObject(navigator, {
                    gameState: window.globalGameState,
                    players: players
                });

                // Connecter le signal
                gameScreen.backToMenu.connect(function () {
                    window.globalGameState.goToMenu();
                    navigator.pop();
                });

                // Démarrer le jeu
                window.globalGameState.setLocalPlayer("local", "Joueur 1", "A", true);
                window.globalGameState.startGame();

                // Naviguer
                navigator.push(gameScreen);
            }
        }
    }
    // Écran Test Réseau
    Component {
        id: networkTestComponent
        NetworkTest {}
    }

    // Écran Recherche de Serveurs
    Component {
        id: browserComponent
        ServerBrowserScreen {
            onBackToMenu: {
                navigator.pop();
            }

            onJoinServer: function (ip, port) {
                console.log("🎮 Connexion à", ip + ":" + port);

                // Connecter au serveur via le NetworkManager global
                window.globalNetwork.connectToServer(ip, port);

                // Retour au menu
                navigator.pop();
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
        case "networkTest":
            navigator.push(networkTestComponent);
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
