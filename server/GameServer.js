/**
 * GameServer.js - Logique de jeu côté serveur
 * 
 * Gère l'état autoritaire du jeu :
 * - Valide les clics des joueurs
 * - Maintient l'état des jauges
 * - Détecte les victoires
 * - Diffuse les mises à jour à tous les clients
 */

class GameServer {
    constructor() {
        // État du serveur
        this.state = {
            phase: "lobby",  // lobby | playing | victory
            teamA: {
                gauge: 0,
                players: []
            },
            teamB: {
                gauge: 0,
                players: []
            },
            config: {
                maxGauge: 100,
                territoryName: "Territoire 1"
            },
            winner: null
        };

        // Clients connectés
        this.clients = new Map();  // clientId -> { ws, playerIds: [], playerData: [] }

        // Throttling pour les broadcasts
        this.lastBroadcast = 0;
        this.BROADCAST_INTERVAL = 33; // ~30 FPS
        this.pendingBroadcast = null;

        // Bot Loop
        this.botInterval = null;
        this.BOT_CLICK_RATE_MS = 1000; // Chaque bot tente de cliquer toutes les X ms

        // ==========================================
        // STATISTIQUES DE CLICS (pour la démo latence)
        // ==========================================
        // total    : tous les clics reçus pendant la partie
        // validated: clics qui ont réellement incrémenté la jauge
        // rejected : clics reçus APRÈS victoire (pendant la fenêtre de latence)
        this.clickStats = { total: 0, validated: 0, rejected: 0 };

        // Timestamp de la victoire (pour calculer la fenêtre de latence)
        this.victoryTime = null;
        // Durée pendant laquelle on accepte encore des clics "tardifs" à comptabiliser
        this.LATENCY_WINDOW_MS = 5000; // 5s - fenêtre réaliste de latence réseau
        // Temps de broadcast de la victoire (ms)
        this.victoryBroadcastMs = null;

        // Compteur pour IDs uniques de bots
        this.botCounter = 0;

        // Historique des joueurs déconnectés (pour le dashboard)
        this.disconnectedPlayers = [];

        // ==========================================
        // LATENCE RÉSEAU (ping/pong + rapports bots)
        // ==========================================
        this.latencyData = {
            reports: new Map(),         // playerId -> { avgRtt, minRtt, maxRtt, sampleCount, lastUpdate }
            victoryNotifDelays: []      // [{ playerId, delay, timestamp }]
        };
    }

    /**
     * Ajoute un client connecté
     */
    addClient(clientId, ws) {
        this.clients.set(clientId, {
            ws: ws,
            playerIds: [],      // Liste des IDs de joueurs créés par ce client
            playerData: []      // Liste des données de joueurs
        });
        console.log(`✅ GameServer: Client ${clientId} ajouté`);
    }

    /**
     * Retire un client déconnecté
     */
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.playerIds.length > 0) {
            // Sauvegarder les joueurs pour le dashboard avant suppression
            client.playerIds.forEach(playerId => {
                const player = this.getPlayer(playerId);
                if (player) {
                    this.disconnectedPlayers.push({
                        ...player,
                        name: player.name + ' (déco)',
                        disconnectedAt: Date.now()
                    });
                }
                this.removePlayer(playerId);
                console.log(`👤 GameServer: Joueur ${playerId} retiré (client déconnecté)`);
            });
            this.broadcastStateUpdate();
        }
        this.clients.delete(clientId);
        console.log(`❌ GameServer: Client ${clientId} retiré`);
    }

    /**
     * Gère un message reçu d'un client
     */
    handleMessage(clientId, message) {
        const { type } = message;

        switch (type) {
            case "player_join":
                this.handlePlayerJoin(clientId, message);
                break;
            case "click":
                this.handleClick(clientId, message);
                break;
            case "start_game":
                this.handleStartGame(clientId, message);
                break;
            case "reset_game":
                this.handleResetGame(clientId, message);
                break;
            case "add_bot":
                this.handleAddBot(clientId, message);
                break;
            case "remove_bot":
                this.handleRemoveBot(clientId, message);
                break;
            case "update_config":
                this.handleUpdateConfig(clientId, message);
                break;
            case "ping":
                this.handlePing(clientId, message);
                break;
            case "latency_report":
                this.handleLatencyReport(clientId, message);
                break;
            case "victory_received":
                this.handleVictoryReceived(clientId, message);
                break;
            default:
                console.warn(`⚠️  GameServer: Type de message inconnu: ${type}`);
        }
    }

    /**
     * Gère l'arrivée d'un joueur
     */
    handlePlayerJoin(clientId, message) {
        const { playerId, name } = message; // On ignore 'team' venant du client

        console.log(`📨 GameServer: Demande de join reçue pour ${name} (${clientId})`);

        // 1. Stratégie d'Auto-Équilibrage (Auto-Balance)
        // On compte les joueurs ACTIFS dans chaque équipe
        const countA = this.state.teamA.players.length;
        const countB = this.state.teamB.players.length;

        let assignedTeam = "A";

        // Logique : On remplit A, puis B, puis A, puis B...
        if (countA > countB) {
            assignedTeam = "B";
        } else if (countB > countA) {
            assignedTeam = "A";
        } else {
            // Égalité ? On alterne basé sur le nombre total (si pair -> A, impair -> B)
            // Ou plus simple : priorité à A par défaut s'il n'y a personne
            assignedTeam = "A";
        }

        console.log(`⚖️  Auto-Balance: A=${countA} vs B=${countB} -> Assignation ${assignedTeam}`);

        console.log(`👤 GameServer: Joueur VALIDÉ: ${name} -> Team ${assignedTeam}`);

        // Créer le joueur avec l'équipe imposée
        const playerData = {
            id: playerId,
            name: name || `Joueur ${countA + countB + 1}`,
            team: assignedTeam,
            score: 0,
            isBot: false,
            isHost: false,
            clickHistory: [] // Historique des timestamps de clics
        };

        // Stocker dans le client (ajouter à la liste)
        const client = this.clients.get(clientId);
        if (client) {
            // Éviter les doublons
            if (!client.playerIds.includes(playerId)) {
                client.playerIds.push(playerId);
                client.playerData.push(playerData);
            }
        }

        // Ajouter à l'équipe
        this.addPlayer(playerData);

        // Broadcast l'état complet au nouveau joueur (pour qu'il sache qui il est)
        this.sendStateToClient(clientId);

        // Broadcast le lobby à tous les clients
        this.broadcastLobbyUpdate();

        // Broadcast de l'état global (pour mettre à jour les jauges/scores partout)
        this.broadcastStateUpdate();
    }

    /**
     * Gère un clic de joueur
     *
     * Logique de latence :
     * - Phase "playing"  → clic validé (incrémente jauge)
     * - Phase "victory" (dans la fenêtre de 1s) → clic rejeté mais COMPTÉ
     * - Phase "victory" (après la fenêtre) → ignoré silencieusement
     */
    handleClick(clientId, message) {
        const { playerId } = message;
        const now = Date.now();

        // ── Phase VICTOIRE : fenêtre de latence ──────────────────────────────
        if (this.state.phase === "victory") {
            // On ne compte les clics tardifs que pendant la fenêtre de latence
            if (this.victoryTime && (now - this.victoryTime) < this.LATENCY_WINDOW_MS) {
                this.clickStats.total++;
                this.clickStats.rejected++;
                // Tracker par joueur
                const latePlayer = this.getPlayer(playerId);
                if (latePlayer) {
                    latePlayer.rejectedClicks = (latePlayer.rejectedClicks || 0) + 1;
                }
                // Log seulement tous les 1000 clics rejetés pour éviter de saturer la mémoire
                if (this.clickStats.rejected % 1000 === 0) {
                    console.log(`🚫 ${this.clickStats.rejected} clics rejetés (latence) - dernier: ${playerId}`);
                }
            }
            return;
        }

        // ── Phase non "playing" (lobby, etc.) : ignorer ──────────────────────
        if (this.state.phase !== "playing") {
            return;
        }

        // ── Trouver le joueur ────────────────────────────────────────────────
        const player = this.getPlayer(playerId);
        if (!player) {
            console.warn(`⚠️  GameServer: Joueur ${playerId} non trouvé`);
            return;
        }

        // ── Comptabiliser le clic total ──────────────────────────────────────
        this.clickStats.total++;

        // ── Vérifier si la jauge de son équipe est pleine ────────────────────
        const teamData = this.getTeamData(player.team);
        if (teamData.gauge >= this.state.config.maxGauge) {
            // Jauge déjà pleine mais victoire pas encore déclarée (race condition)
            this.clickStats.rejected++;
            player.rejectedClicks = (player.rejectedClicks || 0) + 1;
            return;
        }

        // ── Incrémenter la jauge (clic VALIDÉ) ──────────────────────────────
        teamData.gauge++;
        this.clickStats.validated++;

        // Incrémenter le score du joueur
        player.score++;
        // Limiter l'historique pour éviter les fuites mémoire en stress test
        if (player.clickHistory.length < 50) {
            player.clickHistory.push(now);
        }

        // ── Vérifier la victoire ─────────────────────────────────────────────
        const winner = this.checkVictory();
        if (winner) {
            this.state.winner = winner;
            this.state.phase = "victory";
            this.victoryTime = Date.now();  // Marquer le début de la fenêtre de latence
            this.stopBotLoop();
            this.broadcastVictory(winner);
        } else {
            this.broadcastStateUpdate();
        }
    }

    /**
     * Simule un clic de bot
     */
    simulateBotClicks() {
        if (this.state.phase !== "playing") return;

        this.getAllPlayers().forEach(player => {
            if (player.isBot) {
                // Probabilité de clic variable pour faire "vivant"
                if (Math.random() > 0.3) {
                    this.handleBotClick(player);
                }
            }
        });
    }

    handleBotClick(player) {
        // Vérifier si la jauge de son équipe est pleine
        const teamData = this.getTeamData(player.team);
        if (teamData.gauge >= this.state.config.maxGauge) return;

        // Incrémenter
        teamData.gauge++;
        player.score++;
        player.clickHistory.push(Date.now());

        // Vérifier victoire (rare que ce soit le bot qui gagne pile au tick, mais possible)
        const winner = this.checkVictory();
        if (winner) {
            this.state.winner = winner;
            this.state.phase = "victory";
            this.victoryTime = Date.now();  // Marquer le début de la fenêtre de latence
            this.stopBotLoop();
            this.broadcastVictory(winner);
        } else {
            this.broadcastStateUpdate();
        }
    }

    startBotLoop() {
        if (this.botInterval) clearInterval(this.botInterval);
        console.log("🤖 GameServer: Démarrage de l'IA");
        this.botInterval = setInterval(() => {
            this.simulateBotClicks();
        }, 500); // Check 2 fois par seconde
    }

    stopBotLoop() {
        if (this.botInterval) {
            clearInterval(this.botInterval);
            this.botInterval = null;
            console.log("🤖 GameServer: Arrêt de l'IA");
        }
    }

    /**
     * Démarre le jeu
     */
    handleStartGame(clientId, message) {
        console.log("🎮 GameServer: Démarrage du jeu");
        this.state.phase = "playing";
        this.state.teamA.gauge = 0;
        this.state.teamB.gauge = 0;
        this.state.winner = null;

        // Reset des compteurs de clics
        this.clickStats = { total: 0, validated: 0, rejected: 0 };
        this.victoryTime = null;

        // Reset des données de latence
        this.latencyData.reports.clear();
        this.latencyData.victoryNotifDelays = [];

        // Reset des scores
        this.getAllPlayers().forEach(player => {
            player.score = 0;
            player.clickHistory = [];
        });

        this.startBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Réinitialise le jeu
     */
    handleResetGame(clientId, message) {
        console.log("🔄 GameServer: Reset du jeu");
        this.state.phase = "lobby";
        this.state.teamA.gauge = 0;
        this.state.teamB.gauge = 0;
        this.state.winner = null;

        // Reset des compteurs de clics
        this.clickStats = { total: 0, validated: 0, rejected: 0 };
        this.victoryTime = null;
        this.disconnectedPlayers = [];

        // Reset des données de latence
        this.latencyData.reports.clear();
        this.latencyData.victoryNotifDelays = [];

        // Reset des scores
        this.getAllPlayers().forEach(player => {
            player.score = 0;
            player.clickHistory = [];
        });

        this.stopBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Ajoute un joueur à l'équipe
     */
    addPlayer(playerData) {
        const teamData = this.getTeamData(playerData.team);

        // Vérifier si le joueur existe déjà
        const existingIndex = teamData.players.findIndex(p => p.id === playerData.id);
        if (existingIndex >= 0) {
            teamData.players[existingIndex] = playerData;
        } else {
            teamData.players.push(playerData);
        }
    }

    /**
     * Retire un joueur
     */
    removePlayer(playerId) {
        // Chercher dans les deux équipes
        this.state.teamA.players = this.state.teamA.players.filter(p => p.id !== playerId);
        this.state.teamB.players = this.state.teamB.players.filter(p => p.id !== playerId);
    }

    /**
     * Retourne un joueur par ID
     */
    getPlayer(playerId) {
        const all = this.getAllPlayers();
        return all.find(p => p.id === playerId) || null;
    }

    /**
     * Retourne tous les joueurs
     */
    getAllPlayers() {
        return [...this.state.teamA.players, ...this.state.teamB.players];
    }

    /**
     * Retourne les données d'une équipe
     */
    getTeamData(team) {
        return team === "A" ? this.state.teamA : this.state.teamB;
    }

    /**
     * Vérifie si une équipe a gagné
     */
    checkVictory() {
        if (this.state.teamA.gauge >= this.state.config.maxGauge) {
            return "A";
        }
        if (this.state.teamB.gauge >= this.state.config.maxGauge) {
            return "B";
        }
        return null;
    }

    /**
     * Envoie l'état complet à un client spécifique
     */
    sendStateToClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.ws) return;

        const message = {
            type: "state_update",
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            players: this.getAllPlayers(),
            phase: this.state.phase,
            timestamp: Date.now()
        };

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi à ${clientId}:`, error.message);
        }
    }

    /**
     * Diffuse une mise à jour d'état à tous les clients (avec throttling)
     */
    broadcastStateUpdate() {
        const now = Date.now();

        // Throttling : max 30 updates/seconde
        if (now - this.lastBroadcast < this.BROADCAST_INTERVAL) {
            if (!this.pendingBroadcast) {
                this.pendingBroadcast = setTimeout(() => {
                    this.pendingBroadcast = null;
                    this.broadcastStateUpdate();
                }, this.BROADCAST_INTERVAL);
            }
            return;
        }

        this.lastBroadcast = now;
        this.pendingBroadcast = null;

        const message = {
            type: "state_update",
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            maxGauge: this.state.config.maxGauge,
            players: this.getAllPlayers(),
            phase: this.state.phase,
            timestamp: now
        };

        this.broadcast(message);
    }

    /**
     * Diffuse la victoire à tous les clients
     */
    broadcastVictory(winner) {
        console.log(`🏆 GameServer: Victoire équipe ${winner}!`);
        console.log(`📊 Stats: ${this.clickStats.total} clics total | ${this.clickStats.validated} validés | ${this.clickStats.rejected} rejetés`);

        const message = {
            type: "victory",
            winner: winner,
            finalScores: this.getAllPlayers(),
            // ── Statistiques de latence ──────────────────────────────────────
            clickStats: {
                total: this.clickStats.total,
                validated: this.clickStats.validated,
                rejected: this.clickStats.rejected
            },
            latencyWindowMs: this.LATENCY_WINDOW_MS,
            timestamp: Date.now()
        };

        // Mesurer le temps de broadcast
        const t0 = performance.now();
        this.broadcast(message);
        const t1 = performance.now();
        this.victoryBroadcastMs = parseFloat((t1 - t0).toFixed(3));

        console.log(`⏱️  Broadcast victoire envoyé en ${this.victoryBroadcastMs}ms à ${this.clients.size} client(s)`);
    }

    /**
     * Diffuse l'état du lobby à tous les clients
     */
    broadcastLobbyUpdate() {
        const message = {
            type: "lobby_update",
            players: this.getAllPlayers(),
            phase: this.state.phase,
            maxGauge: this.state.config.maxGauge, // Envoyer la config actuelle
            timestamp: Date.now()
        };

        console.log(`📝 Lobby broadcast: ${this.getAllPlayers().length} joueurs`);
        this.broadcast(message);
    }

    /**
     * Gère l'ajout d'un bot par l'hôte
     */
    handleAddBot(clientId, message) {
        const { team, name } = message;

        // Vérifier qu'on n'a pas trop de joueurs
        // if (this.getAllPlayers().length >= 4) {
        //    console.warn("⚠️  GameServer: Lobby plein, impossible d'ajouter un bot");
        //    return;
        // } -- LIMIT REMOVED

        const botId = "bot_" + (++this.botCounter) + "_" + Date.now();
        const botName = name || "Bot " + (this.getAllPlayers().length + 1);
        const botTeam = team || (this.state.teamA.players.length <= this.state.teamB.players.length ? "A" : "B");

        const botData = {
            id: botId,
            name: botName,
            team: botTeam,
            score: 0,
            isBot: true,
            isHost: false,
            clickHistory: []
        };

        this.addPlayer(botData);
        console.log(`🤖 GameServer: Bot ajouté: ${botName} (Team ${botTeam})`);

        this.broadcastLobbyUpdate();
    }

    /**
     * Gère le retrait d'un bot
     */
    handleRemoveBot(clientId, message) {
        const { botId } = message;

        const player = this.getPlayer(botId);
        if (!player || !player.isBot) {
            console.warn(`⚠️  GameServer: Bot ${botId} non trouvé`);
            return;
        }

        this.removePlayer(botId);
        console.log(`🤖 GameServer: Bot retiré: ${player.name}`);

        this.broadcastLobbyUpdate();
    }

    // ==========================================
    // LATENCE : Ping/Pong & Rapports
    // ==========================================

    /**
     * Répond immédiatement au ping d'un client pour mesurer le RTT
     */
    handlePing(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'pong',
                clientTs: message.ts,
                serverTs: Date.now()
            }));
        }
    }

    /**
     * Reçoit un rapport de latence d'un bot de stress
     */
    handleLatencyReport(clientId, message) {
        const { playerId, avgRtt, minRtt, maxRtt, sampleCount } = message;
        this.latencyData.reports.set(playerId || clientId, {
            avgRtt, minRtt, maxRtt, sampleCount,
            lastUpdate: Date.now()
        });
    }

    /**
     * Reçoit la confirmation qu'un client a reçu le message de victoire
     * Permet de calculer le délai réel de notification
     */
    handleVictoryReceived(clientId, message) {
        const { playerId, delay } = message;
        this.latencyData.victoryNotifDelays.push({
            playerId: playerId || clientId,
            delay,
            timestamp: Date.now()
        });
    }

    /**
     * Gère la mise à jour de la configuration (Objectif de clics)
     */
    handleUpdateConfig(clientId, message) {
        const { maxGauge } = message;

        if (!maxGauge || maxGauge < 10) {
            return; // Ignorer valeurs invalides
        }

        console.log(`⚙️  GameServer: Config mise à jour: Objectif = ${maxGauge}`);
        this.state.config.maxGauge = maxGauge;

        // Diffuser à tout le monde
        this.broadcastLobbyUpdate();
        this.broadcastStateUpdate();
    }

    /**
     * Envoie un message à tous les clients connectés
     */
    broadcast(message) {
        const json = JSON.stringify(message);
        let sentCount = 0;

        this.clients.forEach((client, clientId) => {
            try {
                if (client.ws && client.ws.readyState === 1) { // OPEN
                    client.ws.send(json);
                    sentCount++;
                }
            } catch (error) {
                console.error(`❌ Erreur broadcast à ${clientId}:`, error.message);
            }
        });

        // console.log(`📡 Broadcast ${message.type} à ${sentCount} clients`);
    }

    /**
     * Retourne les statistiques du serveur
     */
    getStats() {
        // Combiner joueurs actifs + déconnectés pour le dashboard
        const allPlayersWithHistory = [
            ...this.getAllPlayers(),
            ...this.disconnectedPlayers
        ];

        // Agréger les rapports de latence de tous les bots
        let latencyStats = null;
        const reports = Array.from(this.latencyData.reports.values());
        if (reports.length > 0) {
            const avgValues = reports.map(r => r.avgRtt);
            const minValues = reports.map(r => r.minRtt);
            const maxValues = reports.map(r => r.maxRtt);
            const sorted = [...avgValues].sort((a, b) => a - b);
            const p95idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
            const p99idx = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);

            latencyStats = {
                avgRtt: Math.round(avgValues.reduce((a, b) => a + b, 0) / avgValues.length),
                minRtt: Math.round(Math.min(...minValues)),
                maxRtt: Math.round(Math.max(...maxValues)),
                p95Rtt: Math.round(sorted[p95idx]),
                p99Rtt: Math.round(sorted[p99idx]),
                botCount: reports.length
            };
        }

        // Stats de délai de notification de victoire
        let victoryNotifStats = null;
        if (this.latencyData.victoryNotifDelays.length > 0) {
            const delays = this.latencyData.victoryNotifDelays.map(d => d.delay);
            const sorted = [...delays].sort((a, b) => a - b);
            const p95idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
            victoryNotifStats = {
                avgDelay: Math.round(delays.reduce((a, b) => a + b, 0) / delays.length),
                minDelay: Math.round(Math.min(...delays)),
                maxDelay: Math.round(Math.max(...delays)),
                p95Delay: Math.round(sorted[p95idx]),
                botCount: delays.length
            };
        }

        return {
            phase: this.state.phase,
            clients: this.clients.size,
            players: this.getAllPlayers().length,
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            playersList: allPlayersWithHistory,
            clickStats: { ...this.clickStats },
            maxGauge: this.state.config.maxGauge,
            victoryBroadcastMs: this.victoryBroadcastMs,
            latencyStats,
            victoryNotifStats
        };
    }
}

module.exports = GameServer;
