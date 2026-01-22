/**
 * BotController.qml - Contrôleur de bots pour le jeu
 *
 * Gère la création et le contrôle des bots IA avec des Timers QML.
 * S'intègre avec le GameState pour les clics automatiques.
 */

import QtQuick

import "../styles"

QtObject {
    id: root

    // ==========================================
    // PROPRIÉTÉS
    // ==========================================

    // Référence au GameState
    property var gameState: null

    // Est-ce que les bots sont actifs?
    property bool botsRunning: false

    // Configuration des difficultés (intervalle en ms)
    property var difficulties: ({
            "easy": {
                min: 333,
                max: 500
            },
            "normal": {
                min: 200,
                max: 250
            },
            "hard": {
                min: 125,
                max: 167
            }
        })

    // Liste des bots actifs
    property var activeBots: []

    // Statistiques
    property int teamABotClicks: 0
    property int teamBBotClicks: 0

    // ==========================================
    // SIGNAUX
    // ==========================================

    signal botClicked(string team, string botId)
    signal botsStarted
    signal botsStopped

    // ==========================================
    // TIMERS POUR LES BOTS
    // ==========================================

    // Timer pour le Bot 1 (équipe B)
    property Timer bot1Timer: Timer {
        id: bot1Timer
        repeat: true
        interval: 220
        running: false

        onTriggered: {
            if (root.botsRunning && root.gameState) {
                var success = root.gameState.incrementGauge("B");
                if (success) {
                    root.teamBBotClicks++;
                    root.botClicked("B", "bot1");
                    // Varier l'intervalle pour un effet naturel
                    interval = 200 + Math.random() * 50;
                } else {
                    // Jauge pleine
                    root.stopBots();
                }
            }
        }
    }

    // Timer pour le Bot 2 (équipe B)
    property Timer bot2Timer: Timer {
        id: bot2Timer
        repeat: true
        interval: 240
        running: false

        onTriggered: {
            if (root.botsRunning && root.gameState) {
                var success = root.gameState.incrementGauge("B");
                if (success) {
                    root.teamBBotClicks++;
                    root.botClicked("B", "bot2");
                    // Varier l'intervalle
                    interval = 200 + Math.random() * 50;
                } else {
                    root.stopBots();
                }
            }
        }
    }

    // ==========================================
    // MÉTHODES PUBLIQUES
    // ==========================================

    /**
     * Configure les bots (appelé avant startBots)
     */
    function setupBots(teamACount, teamADiff, teamBCount, teamBDiff) {
        teamABotClicks = 0;
        teamBBotClicks = 0;

        // Configuration des intervalles selon la difficulté
        var diffConfig = difficulties[teamBDiff] || difficulties["normal"];

        bot1Timer.interval = diffConfig.min + Math.random() * (diffConfig.max - diffConfig.min);
        bot2Timer.interval = diffConfig.min + Math.random() * (diffConfig.max - diffConfig.min);

        console.log("BotController: Setup - Difficulté:", teamBDiff);
    }

    /**
     * Démarre les bots
     */
    function startBots() {
        if (!gameState) {
            console.warn("BotController: Pas de gameState");
            return;
        }

        console.log("BotController: Démarrage des bots...");

        botsRunning = true;
        bot1Timer.start();
        bot2Timer.start();

        botsStarted();
        console.log("BotController: 2 bots démarrés pour équipe B");
    }

    /**
     * Arrête tous les bots
     */
    function stopBots() {
        bot1Timer.stop();
        bot2Timer.stop();
        botsRunning = false;

        botsStopped();
        console.log("BotController: Bots arrêtés - Clics B:", teamBBotClicks);
    }

    /**
     * Nettoie
     */
    function cleanup() {
        stopBots();
        teamABotClicks = 0;
        teamBBotClicks = 0;
    }

    /**
     * Retourne les stats
     */
    function getStats() {
        return {
            teamAClicks: teamABotClicks,
            teamBClicks: teamBBotClicks,
            running: botsRunning
        };
    }
}
