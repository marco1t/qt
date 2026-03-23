/**
 * SharedStateStore.js - Abstraction de l'etat partage du jeu
 *
 * Deux implementations :
 * - MemoryStore : etat en memoire locale (dev, mono-instance)
 * - RedisStore  : etat partage via Redis (prod, multi-instances)
 *
 * Le choix se fait via la variable REDIS_URL :
 *   REDIS_URL=redis://localhost:6379 node websocket-server.js
 */

// =============================================================
// Interface commune (documentation)
// =============================================================
// getPhase() -> string
// setPhase(phase) -> void
// getGauge(team) -> number
// setGauge(team, value) -> void
// incrementGauge(team) -> number (nouvelle valeur)
// getMaxGauge() -> number
// setMaxGauge(value) -> void
// getWinner() -> string|null
// setWinner(winner) -> void
// getPlayers() -> array
// addPlayer(player) -> void
// removePlayer(playerId) -> void
// getPlayer(playerId) -> object|null
// getClickStats() -> { total, validated, rejected }
// incrementClickStat(field) -> void
// resetClickStats() -> void
// getVictoryTime() -> number|null
// setVictoryTime(ts) -> void
// reset() -> void (remet tout a zero)

// =============================================================
// MemoryStore - Meme comportement qu'avant, zero dependances
// =============================================================

class MemoryStore {
    constructor() {
        this.state = {
            phase: 'lobby',
            teamA: { gauge: 0, players: [] },
            teamB: { gauge: 0, players: [] },
            config: { maxGauge: 100000, territoryName: 'Territoire 1' },
            winner: null
        };
        this.clickStats = { total: 0, validated: 0, rejected: 0 };
        this.victoryTime = null;
        this.victoryBroadcastMs = null;
        this.disconnectedPlayers = [];
        this.latencyData = {
            reports: new Map(),
            victoryNotifDelays: []
        };
    }

    // --- Phase ---
    getPhase() { return this.state.phase; }
    setPhase(phase) { this.state.phase = phase; }

    // --- Jauges ---
    getGauge(team) {
        return team === 'A' ? this.state.teamA.gauge : this.state.teamB.gauge;
    }
    setGauge(team, value) {
        if (team === 'A') this.state.teamA.gauge = value;
        else this.state.teamB.gauge = value;
    }
    incrementGauge(team) {
        if (team === 'A') return ++this.state.teamA.gauge;
        else return ++this.state.teamB.gauge;
    }

    // --- Config ---
    getMaxGauge() { return this.state.config.maxGauge; }
    setMaxGauge(value) { this.state.config.maxGauge = value; }
    getTerritoryName() { return this.state.config.territoryName; }

    // --- Winner ---
    getWinner() { return this.state.winner; }
    setWinner(winner) { this.state.winner = winner; }

    // --- Joueurs ---
    getPlayers(team) {
        if (team === 'A') return this.state.teamA.players;
        if (team === 'B') return this.state.teamB.players;
        return [...this.state.teamA.players, ...this.state.teamB.players];
    }

    addPlayer(player) {
        const teamPlayers = player.team === 'A' ? this.state.teamA.players : this.state.teamB.players;
        const existingIndex = teamPlayers.findIndex(p => p.id === player.id);
        if (existingIndex >= 0) {
            teamPlayers[existingIndex] = player;
        } else {
            teamPlayers.push(player);
        }
    }

    removePlayer(playerId) {
        this.state.teamA.players = this.state.teamA.players.filter(p => p.id !== playerId);
        this.state.teamB.players = this.state.teamB.players.filter(p => p.id !== playerId);
    }

    getPlayer(playerId) {
        return this.getPlayers().find(p => p.id === playerId) || null;
    }

    getPlayerCount(team) {
        if (team) return this.getPlayers(team).length;
        return this.getPlayers().length;
    }

    // --- Click Stats ---
    getClickStats() { return { ...this.clickStats }; }
    incrementClickStat(field) { this.clickStats[field]++; }
    resetClickStats() { this.clickStats = { total: 0, validated: 0, rejected: 0 }; }

    // --- Victory Time ---
    getVictoryTime() { return this.victoryTime; }
    setVictoryTime(ts) { this.victoryTime = ts; }

    getVictoryBroadcastMs() { return this.victoryBroadcastMs; }
    setVictoryBroadcastMs(ms) { this.victoryBroadcastMs = ms; }

    // --- Disconnected Players ---
    getDisconnectedPlayers() { return this.disconnectedPlayers; }
    addDisconnectedPlayer(player) { this.disconnectedPlayers.push(player); }
    clearDisconnectedPlayers() { this.disconnectedPlayers = []; }

    // --- Latency ---
    getLatencyReports() { return this.latencyData.reports; }
    setLatencyReport(id, data) { this.latencyData.reports.set(id, data); }
    clearLatencyReports() { this.latencyData.reports.clear(); }

    getVictoryNotifDelays() { return this.latencyData.victoryNotifDelays; }
    addVictoryNotifDelay(entry) { this.latencyData.victoryNotifDelays.push(entry); }
    clearVictoryNotifDelays() { this.latencyData.victoryNotifDelays = []; }

    // --- Score joueur ---
    updatePlayerScore(playerId, score) {
        const player = this.getPlayer(playerId);
        if (player) player.score = score;
    }

    // --- Verrou distribue (no-op en memoire, une seule instance) ---
    acquireLock(_key) { return true; }
    releaseLock(_key) { }

    // --- Reset complet ---
    resetGame() {
        this.setPhase('lobby');
        this.setGauge('A', 0);
        this.setGauge('B', 0);
        this.setWinner(null);
        this.resetClickStats();
        this.setVictoryTime(null);
        this.clearDisconnectedPlayers();
        this.clearLatencyReports();
        this.clearVictoryNotifDelays();
        this.getPlayers().forEach(p => {
            p.score = 0;
            p.clickHistory = [];
        });
    }

    startGame() {
        this.setPhase('playing');
        this.setGauge('A', 0);
        this.setGauge('B', 0);
        this.setWinner(null);
        this.resetClickStats();
        this.setVictoryTime(null);
        this.clearLatencyReports();
        this.clearVictoryNotifDelays();
        this.getPlayers().forEach(p => {
            p.score = 0;
            p.clickHistory = [];
        });
    }
}

// =============================================================
// RedisStore - Etat partage via Redis (pour multi-instances)
// =============================================================

class RedisStore extends MemoryStore {
    /**
     * @param {string} redisUrl - URL Redis (redis://host:port)
     * @param {string} instanceId - ID unique de cette instance
     */
    constructor(redisUrl, instanceId) {
        super(); // Herite du MemoryStore comme cache local

        this.instanceId = instanceId;
        this.redisUrl = redisUrl;
        this.pub = null;  // Client Redis pour publier
        this.sub = null;  // Client Redis pour s'abonner
        this.redis = null; // Alias pour le client principal (utilise par websocket-server)
        this.ready = false;

        // Callbacks pour les messages inter-instances
        this.onBroadcastReceived = null;
    }

    async connect() {
        try {
            const Redis = require('ioredis');
            this.pub = new Redis(this.redisUrl);
            this.sub = new Redis(this.redisUrl);
            this.redis = this.pub; // Alias pour les operations generales (hset, hgetall, etc.)

            // S'abonner au canal de broadcast
            await this.sub.subscribe('clickwars:broadcasts', 'clickwars:state_sync');

            this.sub.on('message', (channel, message) => {
                try {
                    const data = JSON.parse(message);

                    // Ignorer nos propres messages
                    if (data.sourceInstanceId === this.instanceId) return;

                    if (channel === 'clickwars:broadcasts' && this.onBroadcastReceived) {
                        this.onBroadcastReceived(data);
                    }

                    if (channel === 'clickwars:state_sync') {
                        this._applySyncUpdate(data);
                    }
                } catch (e) {
                    console.error('RedisStore: erreur parsing message pub/sub', e.message);
                }
            });

            this.ready = true;
            console.log(`RedisStore: connecte a ${this.redisUrl} (instance: ${this.instanceId})`);

            // Charger l'etat existant depuis Redis (si une autre instance a deja commence)
            await this._loadInitialState();

            // Sauvegarder un snapshot toutes les 2 secondes
            this._snapshotInterval = setInterval(() => this._saveSnapshot(), 2000);
        } catch (err) {
            console.error('RedisStore: impossible de se connecter a Redis, fallback MemoryStore', err.message);
            this.ready = false;
        }
    }

    // Charger l'etat initial depuis Redis (pour les instances qui rejoignent tard)
    async _loadInitialState() {
        try {
            const snapshot = await this.pub.get('clickwars:state_snapshot');
            if (snapshot) {
                const data = JSON.parse(snapshot);
                this.state.phase = data.phase || 'lobby';
                this.state.teamA.gauge = data.gaugeA || 0;
                this.state.teamB.gauge = data.gaugeB || 0;
                this.state.config.maxGauge = data.maxGauge || 100000;
                this.state.winner = data.winner || null;
                if (data.players) {
                    data.players.forEach(p => super.addPlayer(p));
                }
                this.clickStats = data.clickStats || { total: 0, validated: 0, rejected: 0 };
                this.victoryTime = data.victoryTime || null;
                console.log(`RedisStore: Etat initial charge (phase: ${this.state.phase}, joueurs: ${this.getPlayerCount()})`);
            }
        } catch (e) {
            console.error('RedisStore: erreur chargement etat initial', e.message);
        }
    }

    // Sauvegarder un snapshot de l'etat dans Redis (appele periodiquement)
    async _saveSnapshot() {
        if (!this.ready) return;
        try {
            const snapshot = {
                phase: this.getPhase(),
                gaugeA: this.getGauge('A'),
                gaugeB: this.getGauge('B'),
                maxGauge: this.getMaxGauge(),
                winner: this.getWinner(),
                players: this.getPlayers(),
                clickStats: this.getClickStats(),
                victoryTime: this.getVictoryTime(),
                timestamp: Date.now()
            };
            await this.pub.set('clickwars:state_snapshot', JSON.stringify(snapshot));
        } catch (e) {
            console.error('RedisStore: erreur sauvegarde snapshot', e.message);
        }
    }

    // Publier un broadcast pour que les autres instances le relaient
    async publishBroadcast(message) {
        if (!this.ready) return;
        try {
            await this.pub.publish('clickwars:broadcasts', JSON.stringify({
                ...message,
                sourceInstanceId: this.instanceId
            }));
        } catch (e) {
            console.error('RedisStore: erreur publish broadcast', e.message);
        }
    }

    // Synchroniser un changement d'etat vers les autres instances
    async syncState(update) {
        if (!this.ready) return;
        try {
            await this.pub.publish('clickwars:state_sync', JSON.stringify({
                ...update,
                sourceInstanceId: this.instanceId
            }));
        } catch (e) {
            console.error('RedisStore: erreur sync state', e.message);
        }
    }

    // Appliquer la mise a jour d'etat recue d'une autre instance
    _applySyncUpdate(data) {
        switch (data.action) {
            case 'set_phase':
                super.setPhase(data.phase);
                break;
            case 'set_gauge':
                super.setGauge(data.team, data.value);
                break;
            case 'increment_gauge':
                // On force la valeur plutot qu'incrementer pour eviter les derives
                super.setGauge(data.team, data.newValue);
                break;
            case 'set_winner':
                super.setWinner(data.winner);
                break;
            case 'add_player':
                super.addPlayer(data.player);
                break;
            case 'remove_player':
                super.removePlayer(data.playerId);
                break;
            case 'increment_click':
                super.incrementClickStat(data.field);
                break;
            case 'reset_game':
                super.resetGame();
                break;
            case 'start_game':
                super.startGame();
                break;
            case 'set_max_gauge':
                super.setMaxGauge(data.value);
                break;
            case 'set_victory_time':
                super.setVictoryTime(data.ts);
                break;
            case 'update_player_score':
                super.updatePlayerScore(data.playerId, data.score);
                break;
        }
    }

    // --- Surcharges avec sync Redis ---

    setPhase(phase) {
        super.setPhase(phase);
        this.syncState({ action: 'set_phase', phase });
    }

    setGauge(team, value) {
        super.setGauge(team, value);
        this.syncState({ action: 'set_gauge', team, value });
    }

    incrementGauge(team) {
        const newValue = super.incrementGauge(team);
        this.syncState({ action: 'increment_gauge', team, newValue });
        return newValue;
    }

    setMaxGauge(value) {
        super.setMaxGauge(value);
        this.syncState({ action: 'set_max_gauge', value });
    }

    setWinner(winner) {
        super.setWinner(winner);
        this.syncState({ action: 'set_winner', winner });
    }

    addPlayer(player) {
        super.addPlayer(player);
        this.syncState({ action: 'add_player', player });
    }

    removePlayer(playerId) {
        super.removePlayer(playerId);
        this.syncState({ action: 'remove_player', playerId });
    }

    incrementClickStat(field) {
        super.incrementClickStat(field);
        this.syncState({ action: 'increment_click', field });
    }

    setVictoryTime(ts) {
        super.setVictoryTime(ts);
        this.syncState({ action: 'set_victory_time', ts });
    }

    updatePlayerScore(playerId, score) {
        super.updatePlayerScore(playerId, score);
        this.syncState({ action: 'update_player_score', playerId, score });
    }

    resetGame() {
        super.resetGame();
        this.syncState({ action: 'reset_game' });
    }

    startGame() {
        super.startGame();
        this.syncState({ action: 'start_game' });
    }

    // Verrou distribue via Redis SETNX
    async acquireLock(key, ttlMs = 5000) {
        if (!this.ready) return true;
        try {
            const result = await this.pub.set(
                `clickwars:lock:${key}`,
                this.instanceId,
                'PX', ttlMs,
                'NX'
            );
            return result === 'OK';
        } catch (e) {
            console.error('RedisStore: erreur acquireLock', e.message);
            return true; // Fallback : on laisse passer
        }
    }

    async releaseLock(key) {
        if (!this.ready) return;
        try {
            const current = await this.pub.get(`clickwars:lock:${key}`);
            if (current === this.instanceId) {
                await this.pub.del(`clickwars:lock:${key}`);
            }
        } catch (e) {
            console.error('RedisStore: erreur releaseLock', e.message);
        }
    }

    async disconnect() {
        if (this._snapshotInterval) clearInterval(this._snapshotInterval);
        if (this.pub) await this.pub.quit();
        if (this.sub) await this.sub.quit();
    }
}

// =============================================================
// Factory : choisit le bon store selon l'environnement
// =============================================================

function createStore(instanceId) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        console.log(`SharedStateStore: mode REDIS (${redisUrl})`);
        return new RedisStore(redisUrl, instanceId);
    }
    console.log('SharedStateStore: mode MEMOIRE (mono-instance)');
    return new MemoryStore();
}

module.exports = { MemoryStore, RedisStore, createStore };
