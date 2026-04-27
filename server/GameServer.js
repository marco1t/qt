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
        this.shortId = this.instanceId.slice(0, 8);
        this.TAG = `[instance:${this.shortId}]`;
        this.broadcastSeq = 0;
        this.RECONNECT_GRACE_MS = parseInt(process.env.RECONNECT_GRACE_MS || '30000', 10);

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

        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredDisconnectedPlayers();
        }, Math.max(5000, this.RECONNECT_GRACE_MS));
        if (this.cleanupInterval.unref) this.cleanupInterval.unref();
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
                this._markPlayerDisconnected(playerId, clientId);
            });
            this._broadcastLobbyAndState();
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
        this.cleanupExpiredDisconnectedPlayers();

        const existingPlayer = this.store.getPlayer(playerId);
        if (existingPlayer) {
            this._restorePlayerSession(clientId, existingPlayer, name);
            return;
        }

        // Auto-equilibrage
        const { countA, countB, assignedTeam } = this._assignBalancedTeam();

        console.log(`${this.TAG} Auto-balance: A=${countA} vs B=${countB} -> assigned ${assignedTeam}`);

        const playerData = this._createPlayerData({
            id: playerId,
            name: name || `Joueur ${countA + countB + 1}`,
            team: assignedTeam,
            lastClientId: clientId
        });

        // Stocker dans le client local
        this._attachPlayerToClient(clientId, playerData);

        // Ajouter dans le store partage
        this.store.addPlayer(playerData);

        this.sendStateToClient(clientId);
        this._broadcastLobbyAndState();
    }

    _attachPlayerToClient(clientId, playerData) {
        const client = this.clients.get(clientId);
        if (!client) return;
        if (!client.playerIds.includes(playerData.id)) {
            client.playerIds.push(playerData.id);
        }
        const existingIndex = client.playerData.findIndex(p => p.id === playerData.id);
        if (existingIndex >= 0) {
            client.playerData[existingIndex] = playerData;
        } else {
            client.playerData.push(playerData);
        }
    }

    _assignBalancedTeam() {
        const countA = this.store.getPlayerCount('A');
        const countB = this.store.getPlayerCount('B');
        let assignedTeam = "A";

        if (countA > countB) {
            assignedTeam = "B";
        } else if (countB > countA) {
            assignedTeam = "A";
        }

        return { countA, countB, assignedTeam };
    }

    _createPlayerData({ id, name, team, lastClientId = null, isBot = false }) {
        return {
            id,
            name,
            team,
            score: 0,
            isBot,
            isHost: false,
            isDisconnected: false,
            disconnectedAt: null,
            lastClientId,
            clickHistory: []
        };
    }

    _restorePlayerSession(clientId, existingPlayer, name) {
        const canReconnect = this._isWithinReconnectGrace(existingPlayer);
        const restoredPlayer = this.store.updatePlayer(existingPlayer.id, {
            name: name || existingPlayer.name,
            isDisconnected: false,
            disconnectedAt: null,
            lastClientId: clientId
        }) || existingPlayer;

        this._attachPlayerToClient(clientId, restoredPlayer);

        if (canReconnect) {
            console.log(`${this.TAG} Player reconnected: ${restoredPlayer.name} (${existingPlayer.id})`);
        } else {
            console.log(`${this.TAG} Player refreshed existing session: ${restoredPlayer.name} (${existingPlayer.id})`);
        }

        this.sendStateToClient(clientId);
        this._broadcastLobbyAndState();
    }

    _isWithinReconnectGrace(player) {
        return !!(
            player.isDisconnected &&
            player.disconnectedAt &&
            Date.now() - player.disconnectedAt <= this.RECONNECT_GRACE_MS
        );
    }

    _markPlayerDisconnected(playerId, clientId) {
        const player = this.store.getPlayer(playerId);
        if (!player) return;
        if (player.lastClientId && player.lastClientId !== clientId) {
            console.log(`${this.TAG} Stale disconnect ignored for player ${playerId}`);
            return;
        }

        this.store.updatePlayer(playerId, {
            isDisconnected: true,
            disconnectedAt: Date.now(),
            lastClientId: clientId
        });
        console.log(`${this.TAG} Player ${playerId} marked disconnected (client disconnected)`);
    }

    _broadcastLobbyAndState() {
        this.broadcastLobbyUpdate();
        this.broadcastStateUpdate();
    }

    /**
     * Gere un clic de joueur
     */
    handleClick(clientId, message) {
        const { playerId } = message;

        // Phase VICTOIRE : tous les clics sont rejetes et comptabilises
        if (this.store.getPhase() === "victory") {
            this.store.incrementClickStat('total');
            this.store.incrementClickStat('rejected');
            const latePlayer = this.store.getPlayer(playerId);
            if (latePlayer) {
                latePlayer.rejectedClicks = (latePlayer.rejectedClicks || 0) + 1;
            }
            return;
        }

        if (this.store.getPhase() !== "playing") return;

        const player = this.store.getPlayer(playerId);
        if (!player) {
            console.warn(`${this.TAG} Player ${playerId} not found`);
            return;
        }
        if (player.isDisconnected) {
            console.warn(`${this.TAG} Player ${playerId} is disconnected`);
            return;
        }

        this.store.incrementClickStat('total');

        if (this.store.getGauge(player.team) >= this.store.getMaxGauge()) {
            this.store.incrementClickStat('rejected');
            player.rejectedClicks = (player.rejectedClicks || 0) + 1;
            return;
        }

        this._applyValidClick(player);
    }

    /**
     * Simule les clics de bots (une seule instance via verrou distribue)
     */
    async simulateBotClicks() {
        if (this.store.getPhase() !== "playing") return;

        const acquired = await this.store.acquireLock('bot_loop', 1000);
        if (!acquired) return;

        try {
            this.store.getPlayers().forEach(player => {
                if (player.isBot && Math.random() > 0.3) {
                    if (this.store.getGauge(player.team) < this.store.getMaxGauge()) {
                        this._applyValidClick(player);
                    }
                }
            });
        } finally {
            await this.store.releaseLock('bot_loop');
        }
    }

    /**
     * Applique un clic valide (shared between handleClick and bot clicks)
     */
    _applyValidClick(player) {
        this.store.incrementGauge(player.team);
        this.store.incrementClickStat('validated');
        player.score++;
        if (player.clickHistory.length < 50) {
            player.clickHistory.push(Date.now());
        }
        this.store.updatePlayer(player.id, {
            score: player.score,
            clickHistory: player.clickHistory
        });

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

    /** Retourne tous les joueurs */
    getAllPlayers() { return this.store.getPlayers(); }

    /** Ajout/retrait direct de joueur (utilise par les tests) */
    addPlayer(playerData) { this.store.addPlayer(playerData); }
    removePlayer(playerId) { this.store.removePlayer(playerId); }

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

    cleanupExpiredDisconnectedPlayers(now = Date.now()) {
        if (!this.store.cleanupDisconnectedPlayers) return 0;
        return this.store.cleanupDisconnectedPlayers(this.RECONNECT_GRACE_MS, now);
    }

    _buildStateHash() {
        const players = this.store.getPlayers()
            .map(p => ({
                id: p.id,
                team: p.team,
                score: p.score || 0,
                isBot: !!p.isBot,
                isDisconnected: !!p.isDisconnected
            }))
            .sort((a, b) => a.id.localeCompare(b.id));

        const payload = {
            phase: this.store.getPhase(),
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            maxGauge: this.store.getMaxGauge(),
            winner: this.store.getWinner(),
            players
        };

        return crypto
            .createHash('sha1')
            .update(JSON.stringify(payload))
            .digest('hex')
            .slice(0, 12);
    }

    _decorateMessage(message) {
        const broadcastSeq = ++this.broadcastSeq;
        return {
            ...message,
            messageId: `${this.shortId}:${broadcastSeq}`,
            broadcastSeq,
            stateHash: message.stateHash || this._buildStateHash()
        };
    }

    /**
     * Construit le message d'etat (shared between send and broadcast)
     */
    _buildStateMessage() {
        return {
            type: "state_update",
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            maxGauge: this.store.getMaxGauge(),
            players: this.store.getPlayers(),
            phase: this.store.getPhase(),
            winner: this.store.getWinner(),
            instanceId: this.shortId,
            stateHash: this._buildStateHash(),
            timestamp: Date.now()
        };
    }

    /**
     * Envoie l'etat complet a un client specifique
     */
    sendStateToClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.ws) return;
        try {
            client.ws.send(JSON.stringify(this._buildStateMessage()));
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
        this.broadcast(this._buildStateMessage());
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
            instanceId: this.shortId,
            stateHash: this._buildStateHash(),
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
            instanceId: this.shortId,
            stateHash: this._buildStateHash(),
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
        const botData = this._createPlayerData({
            id: botId,
            name: botName,
            team: botTeam,
            isBot: true
        });

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
        const outgoing = message.messageId ? message : this._decorateMessage(message);
        const json = JSON.stringify(outgoing);
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
            this.store.publishBroadcast(outgoing);
        }
    }

    /**
     * Compute percentile stats from an array of numbers
     */
    static _percentileStats(values) {
        if (values.length === 0) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const p = (pct) => Math.round(sorted[Math.min(Math.floor(sorted.length * pct), sorted.length - 1)]);
        return {
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            min: Math.round(Math.min(...values)),
            max: Math.round(Math.max(...values)),
            p95: p(0.95),
            p99: p(0.99),
            count: values.length
        };
    }

    /**
     * Retourne les statistiques du serveur (pour le dashboard)
     */
    getStats() {
        this.cleanupExpiredDisconnectedPlayers();

        // Latency stats
        const reports = Array.from(this.store.getLatencyReports().values());
        const latencyRaw = GameServer._percentileStats(reports.map(r => r.avgRtt));
        const latencyStats = latencyRaw ? {
            avgRtt: latencyRaw.avg, minRtt: Math.round(Math.min(...reports.map(r => r.minRtt))),
            maxRtt: Math.round(Math.max(...reports.map(r => r.maxRtt))),
            p95Rtt: latencyRaw.p95, p99Rtt: latencyRaw.p99, botCount: latencyRaw.count
        } : null;

        // Victory notif stats
        const delays = this.store.getVictoryNotifDelays().map(d => d.delay);
        const notifRaw = GameServer._percentileStats(delays);
        const victoryNotifStats = notifRaw ? {
            avgDelay: notifRaw.avg, minDelay: notifRaw.min, maxDelay: notifRaw.max,
            p95Delay: notifRaw.p95, botCount: notifRaw.count
        } : null;

        return {
            phase: this.store.getPhase(),
            clients: this.clients.size,
            players: this.store.getPlayerCount(),
            teamAGauge: this.store.getGauge('A'),
            teamBGauge: this.store.getGauge('B'),
            playersList: [...this.store.getPlayers(), ...this.store.getDisconnectedPlayers()],
            clickStats: this.store.getClickStats(),
            maxGauge: this.store.getMaxGauge(),
            victoryBroadcastMs: this.store.getVictoryBroadcastMs(),
            latencyStats,
            victoryNotifStats,
            stateHash: this._buildStateHash(),
            instanceId: this.shortId
        };
    }

    shutdown() {
        this.stopBotLoop();
        if (this.pendingBroadcast) clearTimeout(this.pendingBroadcast);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }
}

module.exports = GameServer;
