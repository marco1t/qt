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
    property string sessionId: "default"
    property string networkStatus: "disconnected" // connected | reconnecting | degraded | overloaded | disconnected
    property var candidateServers: []
    property int reconnectTimeoutMs: 15000
    property int reconnectAttempt: 0
    property double reconnectStartedAt: 0
    property bool manualDisconnect: false
    property bool restoredConnection: false
    property string lastPlayerName: ""
    property string lastPlayerTeam: ""

    signal messageReceived(string senderId, var message)
    signal connectionError(string error)
    signal connected
    signal disconnected
    signal reconnecting
    signal serverStatusChanged(string status, string reason)
    signal sessionError(string code, string message)

    property Timer reconnectTimer: Timer {
        interval: 1000
        repeat: false
        onTriggered: root.connectNextCandidate()
    }

    property WebSocket client: WebSocket {
        id: wsClient
        active: false

        onStatusChanged: {
            if (wsClient.status === WebSocket.Open) {
                var wasReconnecting = root.networkStatus === "reconnecting";
                root.isConnected = true;
                root.networkStatus = "connected";
                root.restoredConnection = wasReconnecting;
                root.reconnectAttempt = 0;

                if (wasReconnecting && root.localPlayerId && root.lastPlayerName.length > 0) {
                    root.joinGame(root.localPlayerId, root.lastPlayerName, root.lastPlayerTeam);
                }

                root.connected();
                console.log("NetworkManager: Connecté au serveur");
            } else if (wsClient.status === WebSocket.Closed) {
                root.isConnected = false;
                if (root.manualDisconnect) {
                    root.networkStatus = "disconnected";
                    root.manualDisconnect = false;
                    root.disconnected();
                    console.log("NetworkManager: Déconnecté du serveur");
                    return;
                }

                if (root.localPlayerId && root.sessionId.length > 0) {
                    root.startReconnect();
                } else {
                    root.networkStatus = "disconnected";
                }
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
                if (msg.type === "session_joined" && msg.sessionId) {
                    root.sessionId = msg.sessionId;
                }
                if (msg.type === "session_error") {
                    root.sessionError(msg.code || "SESSION_ERROR", msg.message || "");
                }
                if (msg.type === "server_status") {
                    root.networkStatus = msg.status === "healthy" ? "connected" : msg.status;
                    root.serverStatusChanged(msg.status || "unknown", msg.reason || "");
                }
                root.messageReceived("server", msg);
            } catch (e) {
                console.error("NetworkManager: Invalid JSON from server:", message);
            }
        }
    }

    // ==========================================
    // CONNEXION
    // ==========================================

    function connectToServer(ip, serverPort, sessionCode) {
        if (root.isConnected) {
            console.warn("NetworkManager: Déjà connecté");
            return;
        }

        root.serverIp = ip || "127.0.0.1";
        if (serverPort) root.port = serverPort;
        if (sessionCode && sessionCode.length > 0) root.sessionId = sessionCode;

        if (!root.localPlayerId || root.localPlayerId.length === 0) {
            root.localPlayerId = "client_" + Date.now();
        }
        root.addCandidateServer(root.serverIp, root.port);
        root.manualDisconnect = false;

        var protocol = "ws://";
        // Si c'est un nom de domaine distant ou le port 443, on passe en sécurisé
        if (root.serverIp.indexOf(".com") !== -1 || root.serverIp.indexOf(".sh") !== -1 || root.port === 443) {
            protocol = "wss://";
        }

        var url = protocol + root.serverIp;
        // Ne pas forcer le port dans l'URL si c'est le standard 443 ou 80 pour eviter des problemes
        if (root.port !== 443 && root.port !== 80) {
            url += ":" + root.port;
        }

        console.log("NetworkManager: Connexion au serveur", url);

        wsClient.active = false;
        wsClient.url = url;
        wsClient.active = true;
    }

    function disconnect() {
        if (!root.isConnected && root.networkStatus !== "reconnecting") return;
        console.log("NetworkManager: Déconnexion");
        root.manualDisconnect = true;
        root.reconnectTimer.stop();
        wsClient.active = false;
        root.isConnected = false;
        root.networkStatus = "disconnected";
    }

    function addCandidateServer(ip, serverPort) {
        var next = [];
        var exists = false;
        for (var i = 0; i < root.candidateServers.length; i++) {
            var current = root.candidateServers[i];
            if (current.ip === ip && current.port === serverPort) exists = true;
            next.push(current);
        }
        if (!exists) next.push({ ip: ip, port: serverPort });
        root.candidateServers = next;
    }

    function startReconnect() {
        if (root.networkStatus !== "reconnecting") {
            root.networkStatus = "reconnecting";
            root.reconnectStartedAt = Date.now();
            root.reconnectAttempt = 0;
            root.reconnecting();
        }
        root.reconnectTimer.restart();
    }

    function connectNextCandidate() {
        if (root.isConnected) return;

        if (Date.now() - root.reconnectStartedAt > root.reconnectTimeoutMs) {
            root.networkStatus = "disconnected";
            root.disconnected();
            return;
        }

        if (!root.candidateServers || root.candidateServers.length === 0) {
            root.addCandidateServer(root.serverIp, root.port);
        }

        var candidate = root.candidateServers[root.reconnectAttempt % root.candidateServers.length];
        root.reconnectAttempt++;
        root.connectToServer(candidate.ip, candidate.port, root.sessionId);
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
        root.localPlayerId = playerId;
        root.lastPlayerName = playerName;
        root.lastPlayerTeam = team;
        sendToServer({
            type: "player_join",
            sessionId: root.sessionId,
            playerId: playerId,
            name: playerName,
            team: team,
            timestamp: Date.now()
        });
    }

    function createSession(sessionCode) {
        if (sessionCode && sessionCode.length > 0) root.sessionId = sessionCode;
        sendToServer({
            type: "create_session",
            sessionId: root.sessionId,
            timestamp: Date.now()
        });
    }

    function sendClick(playerId) {
        sendToServer({
            type: "click",
            sessionId: root.sessionId,
            playerId: playerId,
            timestamp: Date.now()
        });
    }

    function startGame() {
        sendToServer({ type: "start_game", sessionId: root.sessionId, timestamp: Date.now() });
    }

    function resetGame() {
        sendToServer({ type: "reset_game", sessionId: root.sessionId, timestamp: Date.now() });
    }

    Component.onDestruction: {
        if (root.isConnected) disconnect();
    }
}
