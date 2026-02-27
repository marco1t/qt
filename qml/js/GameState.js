/**
 * GameState.js - Gestionnaire d'état global du jeu
 *
 * Module singleton qui gère l'état du jeu :
 * - Jauges des équipes (0-100)
 * - Phase du jeu (menu, lobby, playing, victory)
 * - Joueurs et scores
 * - Notifications de changements
 *
 * Usage dans QML:
 *   import "js/GameState.js" as GameState
 *   GameState.incrementGauge("A")
 */

.pragma library

// =============================================
// ÉTAT DU JEU
// =============================================

var state = {
    // Phase du jeu
    phase: "menu",  // menu | lobby | playing | victory

    // Équipe A (Rouge)
    teamA: {
        gauge: 0,
        players: []
    },

    // Équipe B (Bleu)
    teamB: {
        gauge: 0,
        players: []
    },

    // Joueur local
    localPlayer: {
        id: null,
        name: "Player",
        team: null,  // "A" ou "B"
        score: 0,
        isHost: false
    },

    // Configuration
    config: {
        maxGauge: 100,
        territoryName: "Territoire 1"
    },

    // Réseau
    network: {
        isConnected: false,
        isServer: false,
        serverIp: null
    },

    // Équipe gagnante (après victoire)
    winner: null
};

// =============================================
// SYSTÈME DE NOTIFICATIONS
// =============================================

var _listeners = [];
var _victoryListeners = [];

/**
 * S'abonner aux changements d'état
 * @param {function} callback - Fonction appelée à chaque changement
 */
function subscribe(callback) {
    if (typeof callback === "function") {
        _listeners.push(callback);
    }
}

/**
 * Se désabonner des changements
 * @param {function} callback - Fonction à retirer
 */
function unsubscribe(callback) {
    var index = _listeners.indexOf(callback);
    if (index > -1) {
        _listeners.splice(index, 1);
    }
}

/**
 * S'abonner à l'événement de victoire
 * @param {function} callback - Fonction appelée quand une équipe gagne
 */
function onVictory(callback) {
    if (typeof callback === "function") {
        _victoryListeners.push(callback);
    }
}

/**
 * Notifier tous les abonnés d'un changement
 */
function notify() {
    for (var i = 0; i < _listeners.length; i++) {
        try {
            _listeners[i](state);
        } catch (e) {
            console.error("GameState: Erreur dans listener:", e);
        }
    }
}

/**
 * Notifier de la victoire
 */
function notifyVictory(winner) {
    for (var i = 0; i < _victoryListeners.length; i++) {
        try {
            _victoryListeners[i](winner, state);
        } catch (e) {
            console.error("GameState: Erreur dans victory listener:", e);
        }
    }
}

// =============================================
// API PUBLIQUE - GETTERS
// =============================================

/**
 * Retourne l'état complet du jeu
 * @returns {object} État du jeu
 */
function getState() {
    return state;
}

/**
 * Retourne la jauge d'une équipe
 * @param {string} team - "A" ou "B"
 * @returns {number} Valeur de la jauge (0-100)
 */
function getGauge(team) {
    if (team === "A") return state.teamA.gauge;
    if (team === "B") return state.teamB.gauge;
    return 0;
}

/**
 * Retourne la phase actuelle du jeu
 * @returns {string} Phase (menu, lobby, playing, victory)
 */
function getPhase() {
    return state.phase;
}

/**
 * Retourne la configuration du jeu
 * @returns {object} Configuration
 */
function getConfig() {
    return state.config;
}

// =============================================
// API PUBLIQUE - ACTIONS
// =============================================

/**
 * Incrémente la jauge d'une équipe
 * @param {string} team - "A" ou "B"
 * @returns {boolean} true si le clic est valide, false si jauge pleine
 */
function incrementGauge(team) {
    // Vérifier la phase
    if (state.phase !== "playing") {
        return false;
    }

    // Vérifier l'équipe
    if (team !== "A" && team !== "B") {
        console.warn("GameState: Équipe invalide:", team);
        return false;
    }

    var teamData = (team === "A") ? state.teamA : state.teamB;

    // Vérifier si la jauge est pleine
    if (teamData.gauge >= state.config.maxGauge) {
        return false;
    }

    // Incrémenter la jauge
    teamData.gauge++;

    // Notifier les abonnés
    notify();

    // Vérifier la victoire
    var winner = checkVictory();
    if (winner) {
        state.winner = winner;
        state.phase = "victory";
        notify();
        notifyVictory(winner);
    }

    return true;
}

/**
 * Définit directement la valeur d'une jauge (pour sync réseau)
 * @param {string} team - "A" ou "B"
 * @param {number} value - Nouvelle valeur (0-100)
 */
function setGauge(team, value) {
    value = Math.max(0, Math.min(state.config.maxGauge, value));

    if (team === "A") {
        state.teamA.gauge = value;
    } else if (team === "B") {
        state.teamB.gauge = value;
    }

    notify();

    // Vérifier la victoire
    var winner = checkVictory();
    if (winner && state.phase === "playing") {
        state.winner = winner;
        state.phase = "victory";
        notify();
        notifyVictory(winner);
    }
}

/**
 * Vérifie si une équipe a gagné
 * @returns {string|null} "A", "B" ou null
 */
function checkVictory() {
    if (state.teamA.gauge >= state.config.maxGauge) {
        return "A";
    }
    if (state.teamB.gauge >= state.config.maxGauge) {
        return "B";
    }
    return null;
}

/**
 * Change la phase du jeu
 * @param {string} phase - Nouvelle phase (menu, lobby, playing, victory)
 */
function setPhase(phase) {
    var validPhases = ["menu", "lobby", "playing", "victory"];
    if (validPhases.indexOf(phase) === -1) {
        console.warn("GameState: Phase invalide:", phase);
        return;
    }

    state.phase = phase;
    notify();
}

/**
 * Réinitialise le jeu pour une nouvelle partie
 */
function resetGame() {
    state.teamA.gauge = 0;
    state.teamB.gauge = 0;
    state.winner = null;
    state.phase = "playing";

    // Reset des scores des joueurs
    for (var i = 0; i < state.teamA.players.length; i++) {
        state.teamA.players[i].score = 0;
    }
    for (var j = 0; j < state.teamB.players.length; j++) {
        state.teamB.players[j].score = 0;
    }

    notify();
}

/**
 * Réinitialisation complète (retour au menu)
 */
function fullReset() {
    state.phase = "menu";
    state.teamA.gauge = 0;
    state.teamB.gauge = 0;
    state.teamA.players = [];
    state.teamB.players = [];
    state.winner = null;
    state.localPlayer.score = 0;
    state.localPlayer.team = null;
    state.network.isConnected = false;
    state.network.isServer = false;

    notify();
}

// =============================================
// API PUBLIQUE - JOUEURS
// =============================================

/**
 * Ajoute un joueur à une équipe
 * @param {object} player - { id, name, isBot, team }
 */
function addPlayer(player) {
    if (!player.id || !player.team) {
        console.warn("GameState: Joueur invalide:", player);
        return;
    }

    var teamData = (player.team === "A") ? state.teamA : state.teamB;

    // Vérifier si le joueur existe déjà
    for (var i = 0; i < teamData.players.length; i++) {
        if (teamData.players[i].id === player.id) {
            // Mettre à jour le joueur existant
            teamData.players[i] = player;
            notify();
            return;
        }
    }

    // Ajouter le nouveau joueur
    teamData.players.push({
        id: player.id,
        name: player.name || "Player",
        team: player.team,
        score: player.score || 0,
        isBot: player.isBot || false,
        isHost: player.isHost || false
    });

    notify();
}

/**
 * Retire un joueur
 * @param {string} playerId - ID du joueur à retirer
 */
function removePlayer(playerId) {
    // Chercher dans l'équipe A
    for (var i = 0; i < state.teamA.players.length; i++) {
        if (state.teamA.players[i].id === playerId) {
            state.teamA.players.splice(i, 1);
            notify();
            return;
        }
    }

    // Chercher dans l'équipe B
    for (var j = 0; j < state.teamB.players.length; j++) {
        if (state.teamB.players[j].id === playerId) {
            state.teamB.players.splice(j, 1);
            notify();
            return;
        }
    }
}

/**
 * Retourne tous les joueurs
 * @returns {array} Liste des joueurs
 */
function getAllPlayers() {
    return state.teamA.players.concat(state.teamB.players);
}

/**
 * Retourne un joueur par son ID
 * @param {string} playerId - ID du joueur
 * @returns {object|null} Joueur ou null
 */
function getPlayer(playerId) {
    var all = getAllPlayers();
    for (var i = 0; i < all.length; i++) {
        if (all[i].id === playerId) {
            return all[i];
        }
    }
    return null;
}

/**
 * Incrémente le score d'un joueur
 * @param {string} playerId - ID du joueur
 */
function incrementPlayerScore(playerId) {
    var player = getPlayer(playerId);
    if (player) {
        player.score++;
        notify();
    }
}

// =============================================
// API PUBLIQUE - JOUEUR LOCAL
// =============================================

/**
 * Configure le joueur local
 * @param {object} config - { id, name, team, isHost }
 */
function setLocalPlayer(config) {
    if (config.id !== undefined) state.localPlayer.id = config.id;
    if (config.name !== undefined) state.localPlayer.name = config.name;
    if (config.team !== undefined) state.localPlayer.team = config.team;
    if (config.isHost !== undefined) state.localPlayer.isHost = config.isHost;
    notify();
}

/**
 * Retourne le joueur local
 * @returns {object} Joueur local
 */
function getLocalPlayer() {
    return state.localPlayer;
}

// =============================================
// API PUBLIQUE - RÉSEAU
// =============================================

/**
 * Configure l'état réseau
 * @param {object} config - { isConnected, isServer, serverIp }
 */
function setNetworkState(config) {
    if (config.isConnected !== undefined) state.network.isConnected = config.isConnected;
    if (config.isServer !== undefined) state.network.isServer = config.isServer;
    if (config.serverIp !== undefined) state.network.serverIp = config.serverIp;
    notify();
}

/**
 * Synchronise l'état depuis le serveur
 * @param {object} serverState - État reçu du serveur
 */
function syncFromServer(serverState) {
    if (serverState.teamAGauge !== undefined) {
        state.teamA.gauge = serverState.teamAGauge;
    }
    if (serverState.teamBGauge !== undefined) {
        state.teamB.gauge = serverState.teamBGauge;
    }
    if (serverState.phase !== undefined) {
        state.phase = serverState.phase;
    }
    if (serverState.players !== undefined) {
        // Répartir les joueurs par équipe
        state.teamA.players = serverState.players.filter(function (p) { return p.team === "A"; });
        state.teamB.players = serverState.players.filter(function (p) { return p.team === "B"; });
    }

    if (serverState.maxGauge !== undefined) {
        state.config.maxGauge = serverState.maxGauge;
    }

    // CRITICAL FIX: Synchroniser le joueur local avec la vérité du serveur
    // Si le serveur a changé notre équipe (auto-balance), on doit se mettre à jour
    if (state.localPlayer.id && serverState.players) {
        var foundMe = false;
        for (var i = 0; i < serverState.players.length; i++) {
            var p = serverState.players[i];
            if (p.id === state.localPlayer.id) {
                // On s'est trouvé ! Mettre à jour nos infos locales
                if (state.localPlayer.team !== p.team) {
                    console.log("🔄 GameState: Correction équipe locale " + state.localPlayer.team + " -> " + p.team);
                    state.localPlayer.team = p.team;
                }
                // NE PAS écraser isHost depuis le serveur (le serveur envoie toujours false)
                // state.localPlayer.isHost est défini localement par setLocalPlayer()
                state.localPlayer.score = p.score;
                foundMe = true;
                break;
            }
        }
    }

    notify();

    // Vérifier victoire
    if (serverState.winner) {
        state.winner = serverState.winner;
        if (state.phase !== "victory") {
            state.phase = "victory";
            notifyVictory(serverState.winner);
        }
    }
}

/**
 * Synchronise depuis un message de victoire
 * @param {object} victoryMessage - Message de victoire du serveur
 */
function syncVictory(victoryMessage) {
    if (victoryMessage.winner) {
        state.winner = victoryMessage.winner;
        state.phase = "victory";

        if (victoryMessage.finalScores) {
            // Mettre à jour les scores finaux
            state.teamA.players = victoryMessage.finalScores.filter(function (p) { return p.team === "A"; });
            state.teamB.players = victoryMessage.finalScores.filter(function (p) { return p.team === "B"; });
        }

        notify();
        notifyVictory(victoryMessage.winner);
    }
}

// =============================================
// EXPORT POUR TESTS
// =============================================

/**
 * Reset complet pour les tests
 */
function _testReset() {
    state = {
        phase: "menu",
        teamA: { gauge: 0, players: [] },
        teamB: { gauge: 0, players: [] },
        localPlayer: { id: null, name: "Player", team: null, score: 0, isHost: false },
        config: { maxGauge: 100, territoryName: "Territoire 1" },
        network: { isConnected: false, isServer: false, serverIp: null },
        winner: null
    };
    _listeners = [];
    _victoryListeners = [];
}
