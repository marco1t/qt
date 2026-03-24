/**
 * GameServer.js - Logique de jeu cote serveur
 *
 * Gere l'etat autoritaire du jeu :
 * - Valide les clics des joueurs
 * - Maintient l'etat des jauges (via SharedStateStore)
 * - Detecte les victoires
 * - Diffuse les mises a jour a tous les clients
 *
 * Supporte le multi-instances : l'etat est delegue a un store
 * qui peut etre en memoire locale (MemoryStore) ou partage (RedisStore).
 */

const crypto = require('crypto');

class GameServer {
    /**
     * @param {object} store - Instance de MemoryStore ou RedisStore
     * @param {string} [instanceId] - ID unique de cette instance (pour le multi-instances)
     */
    constructor(store, instanceId) {
        if (!store) {
            // Retrocompatibilite : si pas de store, creer un MemoryStore
            const { MemoryStore } = require('./SharedStateStore');
            store = new MemoryStore();
        }

        this.store = store;
        this.instanceId = instanceId || crypto.randomUUID();
        this.TAG = `[instance:${this.instanceId.slice(0, 8)}]`;

        // Clients connectes (toujours LOCAL a cette instance)
        this.clients = new Map();  // clientId -> { ws, playerIds: [], playerData: [] }

        // Throttling pour les broadcasts
        this.lastBroadcast = 0;
        this.BROADCAST_INTERVAL = 33; // ~30 FPS
        this.pendingBroadcast = null;

        // Bot Loop
        this.botInterval = null;
        this.BOT_CLICK_RATE_MS = 1000;

        // Duree de la fenetre de latence pour compter les clics rejetes
        this.LATENCY_WINDOW_MS = 1800000; // 30 minutes

        // Compteur pour IDs uniques de bots (prefixe par l'instanceId)
        this.botCounter = 0;
    }

    /**
     * Ajoute un client connecte (LOCAL a cette instance)
     */
    addClient(clientId, ws) {
        this.clients.set(clientId, {
            ws: ws,
            playerIds: [],
            playerData: []
        });
        console.log(`${this.TAG} Client ${clientId} connected`);
    }

    /**
     * Retire un client deconnecte
     */
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.playerIds.length > 0) {
            client.playerIds.forEach(playerId => {
                const player = this.store.getPlayer(playerId);
                if (player) {
                    this.store.addDisconnectedPlayer({
                        ...player,
                        name: player.name + ' (deco)',
                        disconnectedAt: Date.now()
                    });
                }
                this.store.removePlayer(playerId);
                console.log(`${this.TAG} Player ${playerId} removed (client disconnected)`);
            });
            this.broadcastStateUpdate();
        }
        this.clients.delete(clientId);
        console.log(`${this.TAG} Client ${clientId} disconnected`);
    }

    /**
     * Gere un message recu d'un client
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
                console.warn(`${this.TAG} Unknown message type: ${type}`);
        }
    }

    /**
     * Gere l'arrivee d'un joueur
     */
    handlePlayerJoin(clientId, message) {
        const { playerId, name } = message;

        console.log(`${this.TAG} Player join: ${name} (${clientId})`);

        // Auto-equilibrage
        const countA = this.store.getPlayerCount('A');
        const countB = this.store.getPlayerCount('B');

        let assignedTeam = "A";
        if (countA > countB) {
            assignedTeam = "B";
        } else if (countB > countA) {
            assignedTeam = "A";
        }

        console.log(`${this.TAG} Auto-balance: A=${countA} vs B=${countB} -> assigned ${assignedTeam}`);

        const playerData = {
            id: playerId,
            name: name || `Joueur ${countA + countB + 1}`,
            team: assignedTeam,
            score: 0,
            isBot: false,
            isHost: false,
            clickHistory: []
        };

        // Stocker dans le client local
        const client = this.clients.get(clientId);
        if (client) {
            if (!client.playerIds.includes(playerId)) {
                client.playerIds.push(playerId);
                client.playerData.push(playerData);
            }
        }

        // Ajouter dans le store partage
        this.store.addPlayer(playerData);

        this.sendStateToClient(clientId);
        this.broadcastLobbyUpdate();
        this.broadcastStateUpdate();
    }

    /**
     * Gere un clic de joueur
     */
    handleClick(clientId, message) {
        const { playerId } = message;
        const now = Date.now();

        // Phase VICTOIRE : fenetre de latence
        if (this.store.getPhase() === "victory") {
            const victoryTime = this.store.getVictoryTime();
            if (victoryTime && (now - victoryTime) < this.LATENCY_WINDOW_MS) {
                this.store.incrementClickStat('total');
                this.store.incrementClickStat('rejected');
                const latePlayer = this.store.getPlayer(playerId);
                if (latePlayer) {
                    latePlayer.rejectedClicks = (latePlayer.rejectedClicks || 0) + 1;
                }
                const stats = this.store.getClickStats();
                if (stats.rejected % 1000 === 0) {
                    console.log(`${this.TAG} ${stats.rejected} clicks rejected (latency) - last: ${playerId}`);
                }
            }
            return;
        }

        // Phase non "playing" : ignorer
        if (this.store.getPhase() !== "playing") {
            return;
        }

        // Trouver le joueur
        const player = this.store.getPlayer(playerId);
        if (!player) {
            console.warn(`${this.TAG} Player ${playerId} not found`);
            return;
        }

        this.store.incrementClickStat('total');

        // Verifier si la jauge de son equipe est pleine
        if (this.store.getGauge(player.team) >= this.store.getMaxGauge()) {
            this.store.incrementClickStat('rejected');
            player.rejectedClicks = (player.rejectedClicks || 0) + 1;
            return;
        }

        // Incrementer la jauge (clic VALIDE)
        this.store.incrementGauge(player.team);
        this.store.incrementClickStat('validated');

        // Incrementer le score du joueur (synchro multi-instances)
        player.score++;
        this.store.updatePlayerScore(player.id, player.score);
        if (player.clickHistory.length < 50) {
            player.clickHistory.push(now);
        }

        // Verifier la victoire (avec verrou distribue pour eviter les doublons)
        const winner = this.checkVictory();
        if (winner) {
            this._triggerVictory(winner);
        } else {
            this.broadcastStateUpdate();
        }
    }

    /**
     * Simule les clics de bots
     * En multi-instances, un verrou distribue garantit qu'une seule instance
     * execute les bots a la fois (evite les clics en double).
     */
    async simulateBotClicks() {
        if (this.store.getPhase() !== "playing") return;

        // Verrou distribue : une seule instance fait tourner les bots
        const acquired = await this.store.acquireLock('bot_loop', 1000);
        if (!acquired) return;

        try {
            this.store.getPlayers().forEach(player => {
                if (player.isBot) {
                    if (Math.random() > 0.3) {
                        this.handleBotClick(player);
                    }
                }
            });
        } finally {
            await this.store.releaseLock('bot_loop');
        }
    }

    handleBotClick(player) {
        if (this.store.getGauge(player.team) >= this.store.getMaxGauge()) return;

        this.store.incrementGauge(player.team);
        player.score++;
        this.store.updatePlayerScore(player.id, player.score);
        player.clickHistory.push(Date.now());

        const winner = this.checkVictory();
        if (winner) {
            this._triggerVictory(winner);
        } else {
            this.broadcastStateUpdate();
        }
    }

    startBotLoop() {
        if (this.botInterval) clearInterval(this.botInterval);
        console.log(`${this.TAG} Bot loop started`);
        this.botInterval = setInterval(() => {
            this.simulateBotClicks();
        }, 500);
    }

    stopBotLoop() {
        if (this.botInterval) {
            clearInterval(this.botInterval);
            this.botInterval = null;
            console.log(`${this.TAG} Bot loop stopped`);
        }
    }

    /**
     * Demarre le jeu
     */
    handleStartGame(clientId, message) {
        console.log(`${this.TAG} Game started`);
        this.store.startGame();
        this.startBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Reinitialise le jeu
     */
    handleResetGame(clientId, message) {
        console.log(`${this.TAG} Game reset`);
        this.store.resetGame();
        this.stopBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Retourne un joueur par ID (delegation au store)
     */
    getPlayer(playerId) {
        return this.store.getPlayer(playerId);
    }

    /**
     * Retourne tous les joueurs
     */
    getAllPlayers() {
        return this.store.getPlayers();
    }

    /**
     * Retourne les donnees d'une equipe (objet de compat)
     */
    getTeamData(team) {
        return {
            gauge: this.store.getGauge(team),
            players: this.store.getPlayers(team)
        };
    }

    /**
     * Ajout direct de joueur (utilise par les tests)
     */
    addPlayer(playerData) {
        this.store.addPlayer(playerData);
    }

    /**
     * Retrait direct de joueur (utilise par les tests)
     */
    removePlayer(playerId) {
        this.store.removePlayer(playerId);
    }

    /**
     * Declenche la victoire avec verrou distribue (multi-instances safe)
     * Le verrou empeche deux instances de declarer la victoire en meme temps.
     */
    _triggerVictory(winner) {
        const lockResult = this.store.acquireLock('victory', 10000);

        const applyVictory = (acquired) => {
            if (acquired && this.store.getPhase() !== "victory") {
                this.store.setWinner(winner);
                this.store.setPhase("victory");
                this.store.setVictoryTime(Date.now());
                this.stopBotLoop();
                this.broadcastVictory(winner);
            }
        };

        // Supporte les locks synchrones (MemoryStore) et async (RedisStore)
        if (lockResult && typeof lockResult.then === 'function') {
            lockResult.then(applyVictory);
        } else {
            applyVictory(lockResult);
        }
    }

    /**
     * Verifie si une equipe a gagne
     */
    checkVictory() {
        const maxGauge = this.store.getMaxGauge();
        if (this.store.getGauge('A') >= maxGauge) return "A";
        if (this.store.getGauge('B') >= maxGauge) return "B";
        return null;
    }

    /**
     * Envoie l'etat complet a un client specifique
     */
    sendStateToClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.ws) return;

        const message = {
            type: "state_update",
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            players: this.store.getPlayers(),
            phase: this.store.getPhase(),
            instanceId: this.instanceId.slice(0, 8),
            timestamp: Date.now()
        };

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`${this.TAG} Send error to ${clientId}:`, error.message);
        }
    }

    /**
     * Diffuse une mise a jour d'etat a tous les clients (avec throttling)
     */
    broadcastStateUpdate() {
        const now = Date.now();

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
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            maxGauge: this.store.getMaxGauge(),
            players: this.store.getPlayers(),
            phase: this.store.getPhase(),
            instanceId: this.instanceId.slice(0, 8),
            timestamp: now
        };

        this.broadcast(message);
    }

    /**
     * Diffuse la victoire a tous les clients
     */
    broadcastVictory(winner) {
        const clickStats = this.store.getClickStats();
        console.log(`${this.TAG} Victory team ${winner}!`);
        console.log(`${this.TAG} Stats: ${clickStats.total} total | ${clickStats.validated} validated | ${clickStats.rejected} rejected`);

        const message = {
            type: "victory",
            winner: winner,
            finalScores: this.store.getPlayers(),
            clickStats: clickStats,
            latencyWindowMs: this.LATENCY_WINDOW_MS,
            instanceId: this.instanceId.slice(0, 8),
            timestamp: Date.now()
        };

        const t0 = performance.now();
        this.broadcast(message);
        const t1 = performance.now();
        this.store.setVictoryBroadcastMs(parseFloat((t1 - t0).toFixed(3)));

        console.log(`${this.TAG} Victory broadcast sent in ${this.store.getVictoryBroadcastMs()}ms to ${this.clients.size} client(s)`);
    }

    /**
     * Diffuse l'etat du lobby a tous les clients
     */
    broadcastLobbyUpdate() {
        const message = {
            type: "lobby_update",
            players: this.store.getPlayers(),
            phase: this.store.getPhase(),
            maxGauge: this.store.getMaxGauge(),
            instanceId: this.instanceId.slice(0, 8),
            timestamp: Date.now()
        };

        console.log(`${this.TAG} Lobby broadcast: ${this.store.getPlayerCount()} players`);
        this.broadcast(message);
    }

    /**
     * Gere l'ajout d'un bot par l'hote
     */
    handleAddBot(clientId, message) {
        const { team, name } = message;

        // ID unique globalement grace au prefixe d'instance
        const botId = `bot_${this.instanceId.slice(0,8)}_${++this.botCounter}_${Date.now()}`;
        const botName = name || "Bot " + (this.store.getPlayerCount() + 1);
        const botTeam = team || (this.store.getPlayerCount('A') <= this.store.getPlayerCount('B') ? "A" : "B");

        const botData = {
            id: botId,
            name: botName,
            team: botTeam,
            score: 0,
            isBot: true,
            isHost: false,
            clickHistory: []
        };

        this.store.addPlayer(botData);
        console.log(`${this.TAG} Bot added: ${botName} (Team ${botTeam})`);

        this.broadcastLobbyUpdate();
    }

    /**
     * Gere le retrait d'un bot
     */
    handleRemoveBot(clientId, message) {
        const { botId } = message;

        const player = this.store.getPlayer(botId);
        if (!player || !player.isBot) {
            console.warn(`${this.TAG} Bot ${botId} not found`);
            return;
        }

        this.store.removePlayer(botId);
        console.log(`${this.TAG} Bot removed: ${player.name}`);

        this.broadcastLobbyUpdate();
    }

    // --- Latence : Ping/Pong & Rapports ---

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

    handleLatencyReport(clientId, message) {
        const { playerId, avgRtt, minRtt, maxRtt, sampleCount } = message;
        this.store.setLatencyReport(playerId || clientId, {
            avgRtt, minRtt, maxRtt, sampleCount,
            lastUpdate: Date.now()
        });
    }

    handleVictoryReceived(clientId, message) {
        const { playerId, delay } = message;
        this.store.addVictoryNotifDelay({
            playerId: playerId || clientId,
            delay,
            timestamp: Date.now()
        });
    }

    /**
     * Gere la mise a jour de la configuration
     */
    handleUpdateConfig(clientId, message) {
        const { maxGauge } = message;

        if (!maxGauge || maxGauge < 10) {
            return;
        }

        console.log(`${this.TAG} Config updated: maxGauge = ${maxGauge}`);
        this.store.setMaxGauge(maxGauge);

        this.broadcastLobbyUpdate();
        this.broadcastStateUpdate();
    }

    /**
     * Envoie un message a tous les clients connectes (LOCAL seulement)
     * Si le store est un RedisStore, il publie aussi sur pub/sub
     */
    broadcast(message) {
        const json = JSON.stringify(message);
        let sentCount = 0;

        this.clients.forEach((client, clientId) => {
            try {
                if (client.ws && client.ws.readyState === 1) {
                    client.ws.send(json);
                    sentCount++;
                }
            } catch (error) {
                console.error(`${this.TAG} Broadcast error to ${clientId}:`, error.message);
            }
        });

        // Si on est en mode multi-instances, publier pour les autres instances
        if (this.store.publishBroadcast) {
            this.store.publishBroadcast(message);
        }
    }

    /**
     * Retourne les statistiques du serveur (pour le dashboard)
     */
    getStats() {
        const allPlayersWithHistory = [
            ...this.store.getPlayers(),
            ...this.store.getDisconnectedPlayers()
        ];

        // Agreger les rapports de latence
        let latencyStats = null;
        const reports = Array.from(this.store.getLatencyReports().values());
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

        // Stats de delai de notification de victoire
        let victoryNotifStats = null;
        const delays = this.store.getVictoryNotifDelays();
        if (delays.length > 0) {
            const delayValues = delays.map(d => d.delay);
            const sorted = [...delayValues].sort((a, b) => a - b);
            const p95idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
            victoryNotifStats = {
                avgDelay: Math.round(delayValues.reduce((a, b) => a + b, 0) / delayValues.length),
                minDelay: Math.round(Math.min(...delayValues)),
                maxDelay: Math.round(Math.max(...delayValues)),
                p95Delay: Math.round(sorted[p95idx]),
                botCount: delayValues.length
            };
        }

        return {
            phase: this.store.getPhase(),
            clients: this.clients.size,
            players: this.store.getPlayerCount(),
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            playersList: allPlayersWithHistory,
            clickStats: this.store.getClickStats(),
            maxGauge: this.store.getMaxGauge(),
            victoryBroadcastMs: this.store.getVictoryBroadcastMs(),
            latencyStats,
            victoryNotifStats,
            instanceId: this.instanceId.slice(0, 8)
        };
    }
}

module.exports = GameServer;
