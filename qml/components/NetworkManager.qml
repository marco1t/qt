/**
 * NetworkManager.qml - Gestionnaire réseau WebSocket
 *
 * Gère les communications réseau en mode serveur ou client pour le multijoueur LAN.
 * Utilise WebSocket pour la communication temps réel.
 *
 * NOTE: Le serveur est un processus Node.js externe (voir server/websocket-server.js)
 */

import QtQuick
import QtWebSockets

QtObject {
    id: root

    // ==========================================
    // PROPRIÉTÉS PUBLIQUES
    // ==========================================

    property bool isServer: false
    property bool isConnected: false
    property int port: 7777
    property string serverIp: "127.0.0.1"

    property var connectedClients: ([])  // Liste des clients connectés (mode serveur)
    property string localPlayerId: ""

    // ==========================================
    // SIGNAUX
    // ==========================================

    signal clientConnected(string clientId)
    signal clientDisconnected(string clientId)
    signal messageReceived(string senderId, var message)
    signal serverStarted
    signal serverStopped
    signal connectionError(string error)
    signal connected
    signal disconnected

    // ==========================================
    // CLIENT WEBSOCKET
    // ==========================================

    property WebSocket client: WebSocket {
        id: wsClient
        active: false

        onStatusChanged: {
            handleStatusChange();
        }

        function handleStatusChange() {
            if (wsClient.status === WebSocket.Open) {
                root.isConnected = true;
                root.connected();
                console.log("NetworkManager: Connecté au serveur");
            } else if (wsClient.status === WebSocket.Closed) {
                root.isConnected = false;
                root.disconnected();
                console.log("NetworkManager: Déconnecté du serveur");
            } else if (wsClient.status === WebSocket.Error) {
                root.isConnected = false;
                root.connectionError(wsClient.errorString);
                console.error("NetworkManager Client Error:", wsClient.errorString);
            }
        }

        onTextMessageReceived: function (message) {
            try {
                var msg = JSON.parse(message);
                root.messageReceived("server", msg);
            } catch (e) {
                console.error("NetworkManager: Invalid JSON from server:", message);
            }
        }
    }

    // ==========================================
    // NOTE: Le serveur est externe (Node.js)
    // Ces méthodes ne font que logger un avertissement
    // ==========================================

    function startServer(serverPort) {
        console.warn("⚠️  NetworkManager: Le serveur doit être lancé séparément");
        console.warn("💡 Lancez: cd server && npm install && npm start");
        return false;
    }

    function stopServer() {
        console.warn("⚠️  NetworkManager: Arrêtez le serveur Node.js manuellement (Ctrl+C)");
    }

    function sendToAll(message) {
        console.warn("⚠️  NetworkManager: sendToAll n'est pas disponible côté client");
        console.warn("💡 Utilisez sendToServer(), le serveur Node.js relayera aux autres");
    }

    function sendToClient(clientId, message) {
        console.warn("⚠️  NetworkManager: sendToClient n'est pas disponible côté client");
    }

    function getConnectedClients() {
        return [];
    }

    // ==========================================
    // MÉTHODES PUBLIQUES - CLIENT
    // ==========================================

    function connectToServer(ip, serverPort) {
        if (root.isConnected) {
            console.warn("NetworkManager: Déjà connecté");
            return;
        }

        root.serverIp = ip || "127.0.0.1";
        if (serverPort) {
            root.port = serverPort;
        }

        root.localPlayerId = "client_" + Date.now();

        var url = "ws://" + root.serverIp + ":" + root.port;
        console.log("NetworkManager: Connexion au serveur", url);

        wsClient.url = url;
        wsClient.active = true;
    }

    function disconnect() {
        if (!root.isConnected) {
            return;
        }

        console.log("NetworkManager: Déconnexion");
        wsClient.active = false;
        root.isConnected = false;
    }

    function sendToServer(message) {
        if (!root.isConnected) {
            console.error("NetworkManager:  Pas connecté au serveur");
            return;
        }

        if (wsClient.status !== WebSocket.Open) {
            console.error("NetworkManager: WebSocket non ouvert");
            return;
        }

        var json = JSON.stringify(message);
        wsClient.sendTextMessage(json);
    }

    // ==========================================
    // MÉTHODES DE SYNCHRONISATION DU JEU
    // ==========================================

    /**
     * Rejoindre le jeu en tant que joueur
     */
    function joinGame(playerId, playerName, team) {
        sendToServer({
            type: "player_join",
            playerId: playerId,
            name: playerName,
            team: team,
            timestamp: Date.now()
        });
    }

    /**
     * Envoyer un clic au serveur
     */
    function sendClick(playerId) {
        sendToServer({
            type: "click",
            playerId: playerId,
            timestamp: Date.now()
        });
    }

    /**
     * Démarrer le jeu (host uniquement)
     */
    function startGame() {
        sendToServer({
            type: "start_game",
            timestamp: Date.now()
        });
    }

    /**
     * Réinitialiser le jeu (host uniquement)
     */
    function resetGame() {
        sendToServer({
            type: "reset_game",
            timestamp: Date.now()
        });
    }

    // ==========================================
    // MÉTHODES UTILITAIRES
    // ==========================================

    function getLocalIp() {
        // Note: En QML pur, il n'y a pas de moyen simple d'obtenir l'IP locale
        // Pour l'instant, on retourne localhost
        // Dans une vraie implémentation, il faudrait du C++ ou un plugin
        return "127.0.0.1";
    }

    function cleanup() {
        if (root.isServer) {
            stopServer();
        } else if (root.isConnected) {
            disconnect();
        }
    }

    // Nettoyage à la destruction
    Component.onDestruction: {
        cleanup();
    }
}
