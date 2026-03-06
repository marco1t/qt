/**
 * NetworkManager.qml - Client WebSocket pour le multijoueur LAN
 *
 * Gère la connexion au serveur Node.js externe (server/websocket-server.js).
 */

import QtQuick
import QtWebSockets

QtObject {
    id: root

    property bool isConnected: false
    property int port: 7777
    property string serverIp: "127.0.0.1"
    property string localPlayerId: ""

    signal messageReceived(string senderId, var message)
    signal connectionError(string error)
    signal connected
    signal disconnected

    property WebSocket client: WebSocket {
        id: wsClient
        active: false

        onStatusChanged: {
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
    // CONNEXION
    // ==========================================

    function connectToServer(ip, serverPort) {
        if (root.isConnected) {
            console.warn("NetworkManager: Déjà connecté");
            return;
        }

        root.serverIp = ip || "127.0.0.1";
        if (serverPort) root.port = serverPort;

        root.localPlayerId = "client_" + Date.now();

        var url = "ws://" + root.serverIp + ":" + root.port;
        console.log("NetworkManager: Connexion au serveur", url);

        wsClient.url = url;
        wsClient.active = true;
    }

    function disconnect() {
        if (!root.isConnected) return;
        console.log("NetworkManager: Déconnexion");
        wsClient.active = false;
        root.isConnected = false;
    }

    function sendToServer(message) {
        if (!root.isConnected || wsClient.status !== WebSocket.Open) {
            console.error("NetworkManager: Pas connecté au serveur");
            return;
        }
        wsClient.sendTextMessage(JSON.stringify(message));
    }

    // ==========================================
    // ACTIONS DE JEU
    // ==========================================

    function joinGame(playerId, playerName, team) {
        sendToServer({
            type: "player_join",
            playerId: playerId,
            name: playerName,
            team: team,
            timestamp: Date.now()
        });
    }

    function sendClick(playerId) {
        sendToServer({
            type: "click",
            playerId: playerId,
            timestamp: Date.now()
        });
    }

    function startGame() {
        sendToServer({ type: "start_game", timestamp: Date.now() });
    }

    function resetGame() {
        sendToServer({ type: "reset_game", timestamp: Date.now() });
    }

    Component.onDestruction: {
        if (root.isConnected) disconnect();
    }
}
