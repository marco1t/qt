/**
 * GameStateManager.qml - Interface QML réactive pour GameState.js
 *
 * Ce composant expose l'état du jeu via des propriétés QML observables.
 */

import QtQuick

import "../js/GameState.js" as GameStateJS

QtObject {
    id: root

    // ==========================================
    // PROPRIÉTÉS OBSERVABLES
    // ==========================================

    property string phase: "menu"
    property int teamAGauge: 0
    property int teamBGauge: 0
    property int maxGauge: 100

    property string localPlayerName: "Player"
    property string localPlayerId: ""
    property string localPlayerTeam: ""
    property int localPlayerScore: 0
    property bool isHost: false

    property string territoryName: "Territoire 1"
    property string winner: ""

    property bool isConnected: false
    property bool isServer: false

    // Liste des joueurs du lobby (synchronisée depuis le serveur)
    property var lobbyPlayers: []

    // ==========================================
    // SIGNAUX
    // ==========================================

    signal stateChanged
    signal victory(string winner)
    signal gameStarted
    signal gameReset
    signal lobbyUpdated

    // ==========================================
    // TIMER DE SYNCHRONISATION
    // ==========================================

    property var _syncTimer: Timer {
        interval: 16
        repeat: true
        running: true
        onTriggered: root._syncFromJS()
    }

    // ==========================================
    // MÉTHODES PUBLIQUES
    // ==========================================

    function incrementGauge(team) {
        var result = GameStateJS.incrementGauge(team);
        if (result) {
            _syncFromJS();
        }
        return result;
    }

    function clickForLocalPlayer() {
        if (localPlayerTeam) {
            return incrementGauge(localPlayerTeam);
        }
        return false;
    }

    function resetGame() {
        GameStateJS.resetGame();
        winner = "";  // Reset le winner
        _syncFromJS();
        gameReset();
    }

    function setPhase(newPhase) {
        GameStateJS.setPhase(newPhase);
        _syncFromJS();
        if (newPhase === "playing") {
            gameStarted();
        }
    }

    function startGame() {
        setPhase("playing");
    }

    function setLocalPlayer(id, name, team, host) {
        GameStateJS.setLocalPlayer({
            id: id,
            name: name,
            team: team,
            isHost: host
        });
        _syncFromJS();
    }

    function addPlayer(id, name, team, isBot) {
        GameStateJS.addPlayer({
            id: id,
            name: name,
            team: team,
            isBot: isBot || false
        });
        _syncFromJS();
    }

    function removePlayer(playerId) {
        GameStateJS.removePlayer(playerId);
        _syncFromJS();
    }

    function getAllPlayers() {
        return GameStateJS.getAllPlayers();
    }

    function syncFromServer(serverState) {
        GameStateJS.syncFromServer(serverState);
        _syncFromJS();
    }

    function syncVictory(victoryMessage) {
        GameStateJS.syncVictory(victoryMessage);
        _syncFromJS();
    }

    /**
     * Synchronise l'état du lobby depuis le serveur
     * @param players - Liste des joueurs [{id, name, team, isBot, isHost}]
     */
    function syncLobbyFromServer(players) {
        console.log("📝 GameStateManager: Sync lobby avec", players.length, "joueurs");
        lobbyPlayers = players;
        lobbyUpdated();
    }

    function getFullState() {
        return GameStateJS.getState();
    }

    function goToMenu() {
        GameStateJS.fullReset();
        winner = "";  // Reset le winner
        _syncFromJS();
    }

    // ==========================================
    // MÉTHODES PRIVÉES
    // ==========================================

    function _syncFromJS() {
        var s = GameStateJS.getState();

        if (phase !== s.phase) {
            phase = s.phase;
            if (phase === "playing") {
                gameStarted();
            }
        }
        if (teamAGauge !== s.teamA.gauge)
            teamAGauge = s.teamA.gauge;
        if (teamBGauge !== s.teamB.gauge)
            teamBGauge = s.teamB.gauge;
        if (localPlayerName !== s.localPlayer.name)
            localPlayerName = s.localPlayer.name;
        if (localPlayerId !== (s.localPlayer.id || ""))
            localPlayerId = s.localPlayer.id || "";
        if (localPlayerTeam !== (s.localPlayer.team || ""))
            localPlayerTeam = s.localPlayer.team || "";
        if (localPlayerScore !== s.localPlayer.score)
            localPlayerScore = s.localPlayer.score;
        if (isHost !== s.localPlayer.isHost)
            isHost = s.localPlayer.isHost;
        if (territoryName !== s.config.territoryName)
            territoryName = s.config.territoryName;
        if (maxGauge !== s.config.maxGauge)
            maxGauge = s.config.maxGauge;
        if (isConnected !== s.network.isConnected)
            isConnected = s.network.isConnected;
        if (isServer !== s.network.isServer)
            isServer = s.network.isServer;

        if (s.winner && winner !== s.winner) {
            winner = s.winner;
            victory(winner);
        }
    }

    Component.onCompleted: {
        GameStateJS.subscribe(_syncFromJS);
        GameStateJS.onVictory(function (w) {
            winner = w;
            victory(w);
        });
        _syncFromJS();
    }
}
