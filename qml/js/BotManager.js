/**
 * BotManager.js - Système de gestion des bots IA
 *
 * Gère les bots qui simulent des joueurs humains.
 * Chaque bot clique automatiquement à une vitesse configurable.
 *
 * Usage:
 *   import "js/BotManager.js" as BotManager
 *   var bot = BotManager.createBot("B", "normal")
 *   BotManager.startBot(bot.id, onBotClick)
 */

.pragma library

// =============================================
// CONFIGURATION DES DIFFICULTÉS
// =============================================

var DIFFICULTY = {
    easy: {
        name: "Facile",
        minInterval: 333,    // ~3 clics/sec max
        maxInterval: 500,    // ~2 clics/sec min
        description: "2-3 clics/seconde"
    },
    normal: {
        name: "Normal",
        minInterval: 200,    // ~5 clics/sec max
        maxInterval: 250,    // ~4 clics/sec min
        description: "4-5 clics/seconde"
    },
    hard: {
        name: "Difficile",
        minInterval: 125,    // ~8 clics/sec max
        maxInterval: 167,    // ~6 clics/sec min
        description: "6-8 clics/seconde"
    }
};

// =============================================
// ÉTAT INTERNE
// =============================================

var _bots = {};
var _nextBotId = 1;
var _timers = {};

// Noms aléatoires pour les bots
var BOT_NAMES = [
    "Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta",
    "Clicker Pro", "Auto Max", "Speed King", "Fast Fury",
    "Turbo Bot", "Mega Click", "Super Bot", "Ultra Tap"
];

// =============================================
// API PUBLIQUE - CRÉATION
// =============================================

/**
 * Crée un nouveau bot
 * @param {string} team - "A" ou "B"
 * @param {string} difficulty - "easy", "normal" ou "hard"
 * @returns {object} Le bot créé
 */
function createBot(team, difficulty) {
    if (team !== "A" && team !== "B") {
        console.warn("BotManager: Team invalide:", team);
        return null;
    }

    if (!DIFFICULTY[difficulty]) {
        console.warn("BotManager: Difficulté invalide:", difficulty);
        difficulty = "normal";
    }

    var id = "bot_" + _nextBotId++;
    var name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

    var bot = {
        id: id,
        name: name,
        team: team,
        difficulty: difficulty,
        isActive: false,
        clickCount: 0,
        createdAt: Date.now()
    };

    _bots[id] = bot;

    console.log("BotManager: Bot créé -", name, "(" + team + ",", difficulty + ")");
    return bot;
}

/**
 * Crée plusieurs bots d'un coup
 * @param {string} team - Équipe pour tous les bots
 * @param {number} count - Nombre de bots à créer
 * @param {string} difficulty - Difficulté pour tous
 * @returns {array} Liste des bots créés
 */
function createBots(team, count, difficulty) {
    var bots = [];
    for (var i = 0; i < count; i++) {
        var bot = createBot(team, difficulty);
        if (bot) bots.push(bot);
    }
    return bots;
}

// =============================================
// API PUBLIQUE - CONTRÔLE
// =============================================

/**
 * Démarre un bot
 * @param {string} botId - ID du bot
 * @param {function} clickCallback - Fonction appelée à chaque clic: (team, botId) => void
 */
function startBot(botId, clickCallback) {
    var bot = _bots[botId];
    if (!bot) {
        console.warn("BotManager: Bot non trouvé:", botId);
        return;
    }

    if (bot.isActive) {
        console.log("BotManager: Bot déjà actif:", botId);
        return;
    }

    bot.isActive = true;
    console.log("BotManager: Démarrage bot", bot.name);

    // Programmer le premier clic
    scheduleNextClick(bot, clickCallback);
}

/**
 * Arrête un bot
 * @param {string} botId - ID du bot
 */
function stopBot(botId) {
    var bot = _bots[botId];
    if (!bot) return;

    bot.isActive = false;

    // Annuler le timer
    if (_timers[botId]) {
        clearTimeout(_timers[botId]);
        delete _timers[botId];
    }

    console.log("BotManager: Bot arrêté", bot.name, "- Clics:", bot.clickCount);
}

/**
 * Arrête tous les bots
 */
function stopAllBots() {
    for (var id in _bots) {
        stopBot(id);
    }
    console.log("BotManager: Tous les bots arrêtés");
}

/**
 * Supprime un bot
 * @param {string} botId - ID du bot
 */
function removeBot(botId) {
    stopBot(botId);
    delete _bots[botId];
}

/**
 * Supprime tous les bots
 */
function removeAllBots() {
    stopAllBots();
    _bots = {};
    console.log("BotManager: Tous les bots supprimés");
}

// =============================================
// API PUBLIQUE - QUERIES
// =============================================

/**
 * Retourne tous les bots actifs
 * @returns {array}
 */
function getActiveBots() {
    var active = [];
    for (var id in _bots) {
        if (_bots[id].isActive) {
            active.push(_bots[id]);
        }
    }
    return active;
}

/**
 * Retourne tous les bots d'une équipe
 * @param {string} team - "A" ou "B"
 * @returns {array}
 */
function getBotsByTeam(team) {
    var result = [];
    for (var id in _bots) {
        if (_bots[id].team === team) {
            result.push(_bots[id]);
        }
    }
    return result;
}

/**
 * Retourne un bot par son ID
 * @param {string} botId
 * @returns {object|null}
 */
function getBot(botId) {
    return _bots[botId] || null;
}

/**
 * Retourne tous les bots
 * @returns {array}
 */
function getAllBots() {
    var all = [];
    for (var id in _bots) {
        all.push(_bots[id]);
    }
    return all;
}

/**
 * Retourne les statistiques des bots
 * @returns {object}
 */
function getStats() {
    var stats = {
        totalBots: 0,
        activeBots: 0,
        teamA: { bots: 0, clicks: 0 },
        teamB: { bots: 0, clicks: 0 }
    };

    for (var id in _bots) {
        var bot = _bots[id];
        stats.totalBots++;

        if (bot.isActive) stats.activeBots++;

        if (bot.team === "A") {
            stats.teamA.bots++;
            stats.teamA.clicks += bot.clickCount;
        } else {
            stats.teamB.bots++;
            stats.teamB.clicks += bot.clickCount;
        }
    }

    return stats;
}

// =============================================
// LOGIQUE INTERNE
// =============================================

/**
 * Programme le prochain clic d'un bot
 */
function scheduleNextClick(bot, clickCallback) {
    if (!bot.isActive) return;

    var config = DIFFICULTY[bot.difficulty];

    // Intervalle aléatoire dans la plage (simulation naturelle)
    var interval = config.minInterval +
        Math.random() * (config.maxInterval - config.minInterval);

    _timers[bot.id] = setTimeout(function () {
        if (bot.isActive) {
            // Exécuter le clic
            bot.clickCount++;

            if (clickCallback) {
                clickCallback(bot.team, bot.id);
            }

            // Programmer le prochain clic
            scheduleNextClick(bot, clickCallback);
        }
    }, interval);
}

// =============================================
// UTILITAIRES
// =============================================

/**
 * Retourne les configurations de difficulté
 * @returns {object}
 */
function getDifficultyConfig() {
    return DIFFICULTY;
}

/**
 * Reset complet pour les tests
 */
function _testReset() {
    removeAllBots();
    _nextBotId = 1;
}
