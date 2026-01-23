/**
 * BotController.qml - Contrôleur de bots pour le jeu
 *
 * Gère la création et le contrôle des bots IA avec des Timers QML dynamiques.
 * Supporte N bots par équipe (A et B).
 */

import QtQuick

import "../styles"

Item {
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

    // Liste des timers de bots actifs
    property var botTimers: []

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
    // COMPOSANT POUR CRÉER DES TIMERS
    // ==========================================

    Component {
        id: botTimerComponent

        Timer {
            property string team: "A"
            property string botId: ""
            property var controller: null

            repeat: true
            running: false

            onTriggered: {
                if (controller && controller.botsRunning && controller.gameState) {
                    var success = controller.gameState.incrementGauge(team);
                    if (success) {
                        // Incrémenter stats
                        if (team === "A") {
                            controller.teamABotClicks++;
                        } else {
                            controller.teamBBotClicks++;
                        }

                        controller.botClicked(team, botId);

                        // Varier l'intervalle pour un effet naturel
                        interval = interval * (0.9 + Math.random() * 0.2);
                    } else {
                        // Jauge pleine
                        controller.stopBots();
                    }
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
        console.log("BotController: Setup -", teamACount, "bots équipe A (", teamADiff, "),", teamBCount, "bots équipe B (", teamBDiff, ")");

        // Nettoyer les anciens bots
        cleanup();

        // Reset stats
        teamABotClicks = 0;
        teamBBotClicks = 0;

        // Créer les bots pour l'équipe A
        for (var i = 0; i < teamACount; i++) {
            createBot("A", "botA_" + i, teamADiff);
        }

        // Créer les bots pour l'équipe B
        for (var j = 0; j < teamBCount; j++) {
            createBot("B", "botB_" + j, teamBDiff);
        }

        console.log("BotController: ", botTimers.length, "bots créés au total");
    }

    /**
     * Crée un bot avec son timer
     */
    function createBot(team, botId, difficulty) {
        var diffConfig = difficulties[difficulty] || difficulties["normal"];
        var interval = diffConfig.min + Math.random() * (diffConfig.max - diffConfig.min);

        var timer = botTimerComponent.createObject(root, {
            team: team,
            botId: botId,
            controller: root,
            interval: interval
        });

        if (timer) {
            botTimers.push(timer);
            console.log("✅ Bot créé:", botId, "équipe", team, "intervalle:", Math.round(interval), "ms");
        } else {
            console.error("❌ Erreur création bot:", botId);
        }
    }

    /**
     * Démarre les bots
     */
    function startBots() {
        if (!gameState) {
            console.warn("BotController: Pas de gameState");
            return;
        }

        if (botTimers.length === 0) {
            console.warn("BotController: Aucun bot configuré");
            return;
        }

        console.log("BotController: Démarrage de", botTimers.length, "bots...");

        botsRunning = true;

        // Démarrer tous les timers
        for (var i = 0; i < botTimers.length; i++) {
            botTimers[i].start();
        }

        botsStarted();
        console.log("✅ BotController: Tous les bots sont actifs");
    }

    /**
     * Arrête tous les bots
     */
    function stopBots() {
        console.log("BotController: Arrêt des bots...");

        for (var i = 0; i < botTimers.length; i++) {
            botTimers[i].stop();
        }

        botsRunning = false;
        botsStopped();

        console.log("BotController: Bots arrêtés - Clics A:", teamABotClicks, "Clics B:", teamBBotClicks);
    }

    /**
     * Nettoie tous les bots
     */
    function cleanup() {
        stopBots();

        // Détruire tous les timers
        for (var i = 0; i < botTimers.length; i++) {
            botTimers[i].destroy();
        }

        botTimers = [];
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
            totalBots: botTimers.length,
            running: botsRunning
        };
    }

    // Cleanup à la destruction
    Component.onDestruction: {
        cleanup();
    }
}
