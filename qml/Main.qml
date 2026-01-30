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

    // Navigation en attente (ex: après connexion réussie)
    property string pendingNavigation: ""

    // Propriété pour exposer le gameState aux enfants
    property alias globalGameState: gameStateInstance
    property alias globalNetwork: networkManager

    // Gestionnaire d'état global
    GameStateManager {
        id: gameStateInstance

        onVictory: function (winner) {
            console.log("Victoire équipe:", winner);
        }

        // Quand le jeu démarre (localement ou via réseau)
        onGameStarted: {
            console.log("🎮 Main: Partie démarrée, navigation vers GameScreen");

            // Si on n'est pas déjà sur GameScreen (évite double push)
            var currentScreen = navigator.currentItem ? navigator.currentItem.toString() : "";
            if (currentScreen.indexOf("GameScreen") === -1) {

                // Préparer les joueurs pour le GameScreen
                var players = gameStateInstance.lobbyPlayers;
                if (!players || players.length === 0) {
                    players = gameStateInstance.getAllPlayers();
                }

                console.log("🚀 Lancement avec", players.length, "joueurs");

                // Créer GameScreen
                var gameScreen = gameComponent.createObject(navigator, {
                    gameState: window.globalGameState,
                    networkManager: window.globalNetwork,
                    localPlayerId: window.globalNetwork.localPlayerId,
                    players: players
                });

                // Connecter le signal de retour
                gameScreen.backToMenu.connect(function () {
                    window.globalGameState.goToMenu();
                    navigator.pop();
                    if (navigator.depth > 1)
                        navigator.pop(); // Retour jusqu'au menu
                });

                // Naviguer
                navigator.push(gameScreen);
            }
        }
    }

    // Gestionnaire réseau global
    NetworkManager {
        id: networkManager

        onConnected: {
            console.log("✅ Connecté au serveur !");

            // 1. Définir l'identité réseau (ID généré par NetworkManager)
            var netId = networkManager.localPlayerId;
            var isHost = gameStateInstance.isHost; // Déjà défini dans handleNavigation pour l'hôte

            // Déterminer Nom/Équipe par défaut (Simplification MVP)
            // L'hôte est toujours A, le Rejoignant est B (sauf si logique plus complexe plus tard)
            var name = isHost ? "Créateur" : "Joueur Invité";
            var team = isHost ? "A" : "B";

            console.log("👤 Identification :", netId, name, team, isHost ? "(Hôte)" : "(Client)");

            // 2. Mettre à jour le GameState local avec le bon ID
            gameStateInstance.setLocalPlayer(netId, name, team, isHost);

            // 3. Envoyer la requête de connexion au serveur (CRUCIAL pour être reconnu)
            networkManager.joinGame(netId, name, team);

            // Story 3.2: Navigation automatique vers le lobby après connexion (Client)
            if (window.pendingNavigation === "lobby") {
                console.log("🔄 Navigation automatique vers le Lobby");
                window.pendingNavigation = "";
                navigator.push(lobbyComponent);
            }
        }

        onDisconnected: {
            console.log("❌ Déconnecté du serveur");

            // MVP Story 2.5: Si déconnecté alors qu'on n'est pas au menu → serveur/hôte a quitté
            if (navigator.currentItem && navigator.currentItem.toString().indexOf("GameScreen") !== -1) {
                console.warn("⚠️ L'hôte a quitté la partie. Retour au menu...");

                // Afficher un warning
                globalToast.show("⚠️ Déconnecté du serveur");

                // Retourner au menu
                gameStateInstance.goToMenu();
                navigator.pop(null);
            }
        }

        onMessageReceived: function (senderId, message) {
            console.log("📨 Message de", senderId, ":", message.type || "unknown");

            // Gérer les messages de synchronisation
            switch (message.type) {
            case "state_update":
                // Synchroniser l'état du jeu depuis le serveur
                gameStateInstance.syncFromServer(message);
                break;
            case "victory":
                // Victoire reçue du serveur
                gameStateInstance.syncVictory(message);
                break;
            case "player_left":
                // Story 2.5: Un joueur a quitté - afficher toast
                console.log("👤 Joueur parti:", message.playerName || message.playerId);
                globalToast.showPlayerLeft(message.playerName || message.playerId);
                break;
            case "lobby_update":
                // Story 2.3: Synchroniser l'état du lobby
                console.log("📋 Lobby update:", message.players.length, "joueurs");
                gameStateInstance.syncLobbyFromServer(message.players);
                break;
            default:
                console.log("Message non géré:", JSON.stringify(message));
                break;
            }
        }

        onConnectionError: function (error) {
            console.error("⚠️ Erreur réseau:", error);
            globalToast.show("❌ Erreur réseau: " + error);
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

    // Toast notification global
    ToastNotification {
        id: globalToast
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
            // Story 3.3: Rôle dynamique (Hôte vs Client)
            isHost: window.globalGameState.isHost
            localPlayerId: window.globalNetwork.localPlayerId
            networkManager: window.globalNetwork // CRITICAL FIX: Injecter le networkManager

            onBackToMenu: {
                navigator.pop();
            }

            onStartGame: function (players) {
                console.log("🚀 Lancement de la partie avec", players.length, "joueurs");

                // Créer GameScreen avec les joueurs
                var gameScreen = gameComponent.createObject(navigator, {
                    gameState: window.globalGameState,
                    networkManager: window.globalNetwork,
                    localPlayerId: window.globalNetwork.localPlayerId,
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
        NetworkTest {
            networkManager: window.globalNetwork
        }
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

                // Story 3.2: Préparer la navigation vers le lobby
                window.pendingNavigation = "lobby";

                // Connecter au serveur via le NetworkManager global
                window.globalNetwork.connectToServer(ip, port);

            // Note: On ne fait plus navigator.pop() ici.
            // La navigation se fera dans onConnected.
            }
        }
    }

    // Gestion de la navigation
    function handleNavigation(screenName) {
        console.log("Navigation vers:", screenName);
        switch (screenName) {
        case "lobby":
            // Story 3.3: Créer une partie = devenir Hôte
            console.log("🏠 Création de la partie (Hôte)");

            // 1. Définir comme hôte temporairement (sera confirmé dans onConnected)
            window.globalGameState.setLocalPlayer("local_host", "Créateur", "A", true);

            // 2. Connexion au serveur local (localhost)
            // L'hôte DOIT aussi se connecter au WebSocket server pour parler aux autres
            window.globalNetwork.connectToServer("127.0.0.1", 7777);

            // 3. Aller au lobby
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
