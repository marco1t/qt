const crypto = require('crypto');
const GameServer = require('./GameServer');
const {
    MemoryStore,
    RedisStore,
    DEFAULT_SESSION_ID,
    normalizeSessionId
} = require('./SharedStateStore');

class SessionManager {
    constructor(options = {}) {
        this.instanceId = options.instanceId || crypto.randomUUID();
        this.redisUrl = options.redisUrl || null;
        this.isOverloaded = options.isOverloaded || (() => false);
        this.sessions = new Map();
        this.pendingSessions = new Map();
        this.clientSessions = new Map();
        this.metrics = {
            sessionsCreated: 0,
            sessionsRestored: 0,
            sessionErrors: 0,
            reconnectAttempts: 0
        };
    }

    async initDefault() {
        await this.ensureSession(DEFAULT_SESSION_ID, { create: true });
    }

    get redis() {
        for (const session of this.sessions.values()) {
            if (session.store && session.store.redis) return session.store.redis;
        }
        return null;
    }

    isReady() {
        if (!this.redisUrl) return true;
        const defaultSession = this.sessions.get(DEFAULT_SESSION_ID);
        return !!(defaultSession && defaultSession.store.ready);
    }

    async createSession(sessionId) {
        const normalized = normalizeSessionId(sessionId || this._generateSessionId());
        const session = await this.ensureSession(normalized, { create: true });
        return {
            session,
            sessionId: normalized,
            existed: session.existed === true
        };
    }

    async ensureSession(sessionId, options = {}) {
        const normalized = normalizeSessionId(sessionId);
        const existing = this.sessions.get(normalized);
        if (existing) return existing;
        const pending = this.pendingSessions.get(normalized);
        if (pending) return pending;

        const createPromise = this._createSessionInstance(normalized, options)
            .finally(() => this.pendingSessions.delete(normalized));
        this.pendingSessions.set(normalized, createPromise);
        return createPromise;
    }

    async _createSessionInstance(normalized, options = {}) {
        const shouldCreate = options.create === true || normalized === DEFAULT_SESSION_ID;
        if (!shouldCreate && !(await this.sessionExists(normalized))) return null;

        const store = this.redisUrl
            ? new RedisStore(this.redisUrl, this.instanceId, { sessionId: normalized })
            : new MemoryStore({ sessionId: normalized });

        const server = new GameServer(store, this.instanceId, { sessionId: normalized });
        const session = {
            id: normalized,
            store,
            server,
            createdAt: Date.now(),
            existed: !shouldCreate
        };

        if (store.onBroadcastReceived !== undefined) {
            store.onBroadcastReceived = (message) => {
                if (normalizeSessionId(message.sessionId) !== normalized) return;
                this._relayBroadcast(session, message);
            };
        }

        if (store.connect) {
            await store.connect();
        }

        this.sessions.set(normalized, session);
        this.metrics.sessionsCreated++;
        if (session.existed) this.metrics.sessionsRestored++;
        return session;
    }

    async sessionExists(sessionId) {
        const normalized = normalizeSessionId(sessionId);
        if (this.sessions.has(normalized)) return true;
        if (normalized === DEFAULT_SESSION_ID) return true;
        const redis = this.redis;
        if (!redis) return false;

        try {
            const exists = await redis.sismember('clickwars:sessions:active', normalized);
            return exists === 1;
        } catch (_e) {
            return false;
        }
    }

    async handleMessage(clientId, ws, message) {
        if (message.type === 'create_session') {
            return this._handleCreateSession(clientId, ws, message);
        }

        const explicitSession = !!message.sessionId;
        const sessionId = normalizeSessionId(
            message.sessionId || this.clientSessions.get(clientId) || DEFAULT_SESSION_ID
        );

        if (message.type === 'player_join' && this.isOverloaded()) {
            this._sendSessionError(ws, 'SERVER_OVERLOADED', sessionId, 'Server is overloaded');
            return null;
        }

        const session = await this.ensureSession(sessionId, {
            create: !explicitSession || sessionId === DEFAULT_SESSION_ID
        });

        if (!session) {
            this._sendSessionError(ws, 'SESSION_NOT_FOUND', sessionId, 'Session not found');
            return null;
        }

        this.attachClientToSession(clientId, ws, sessionId);
        if (message.type === 'player_join' && message.playerId && session.store.getPlayer(message.playerId)) {
            this.metrics.reconnectAttempts++;
        }
        session.server.handleMessage(clientId, { ...message, sessionId });
        return session;
    }

    async _handleCreateSession(clientId, ws, message) {
        if (this.isOverloaded()) {
            this._sendSessionError(ws, 'SERVER_OVERLOADED', message.sessionId, 'Server is overloaded');
            return null;
        }

        const { session, sessionId, existed } = await this.createSession(message.sessionId);
        this.attachClientToSession(clientId, ws, sessionId);
        this._send(ws, {
            type: 'session_created',
            sessionId,
            instanceId: session.server.shortId,
            existed,
            timestamp: Date.now()
        });
        return session;
    }

    attachClientToSession(clientId, ws, sessionId) {
        const normalized = normalizeSessionId(sessionId);
        const currentSessionId = this.clientSessions.get(clientId);
        if (currentSessionId === normalized) {
            const session = this.sessions.get(normalized);
            if (session && !session.server.clients.has(clientId)) {
                session.server.addClient(clientId, ws);
            }
            return;
        }

        if (currentSessionId && currentSessionId !== normalized) {
            const oldSession = this.sessions.get(currentSessionId);
            if (oldSession && oldSession.server.clients.has(clientId)) {
                oldSession.server.removeClient(clientId);
            }
        }

        const session = this.sessions.get(normalized);
        if (!session) return;
        session.server.addClient(clientId, ws);
        this.clientSessions.set(clientId, normalized);
    }

    removeClient(clientId) {
        const sessionInfo = this.getClientSessionInfo(clientId);
        if (!sessionInfo) return null;

        const session = this.sessions.get(sessionInfo.sessionId);
        if (session) {
            session.server.removeClient(clientId);
        }
        this.clientSessions.delete(clientId);
        return sessionInfo;
    }

    getClientSessionInfo(clientId) {
        const sessionId = this.clientSessions.get(clientId);
        if (!sessionId) return null;
        const session = this.sessions.get(sessionId);
        if (!session) return { sessionId };
        const client = session.server.clients.get(clientId);
        const playerData = client && client.playerData && client.playerData[0];
        return {
            sessionId,
            playerId: playerData && playerData.id,
            playerName: playerData && playerData.name
        };
    }

    broadcastToSession(sessionId, message) {
        const session = this.sessions.get(normalizeSessionId(sessionId));
        if (!session) return false;
        session.server.broadcast({
            ...message,
            sessionId: session.id
        });
        return true;
    }

    broadcastServerStatus(status) {
        const payload = {
            type: 'server_status',
            status: status.state,
            reason: status.reason || null,
            load: status.load || null,
            timestamp: Date.now()
        };

        for (const session of this.sessions.values()) {
            session.server.clients.forEach((client) => {
                this._send(client.ws, { ...payload, sessionId: session.id });
            });
        }
    }

    getStats() {
        const sessionStats = [];
        const aggregate = {
            phase: 'lobby',
            clients: 0,
            players: 0,
            teamAGauge: 0,
            teamBGauge: 0,
            playersList: [],
            clickStats: { total: 0, validated: 0, rejected: 0 },
            maxGauge: 0,
            victoryBroadcastMs: null,
            latencyStats: null,
            victoryNotifStats: null,
            stateHash: null,
            instanceId: this.instanceId.slice(0, 8),
            sessionId: DEFAULT_SESSION_ID,
            activeSessions: this.sessions.size,
            sessions: sessionStats,
            sessionMetrics: { ...this.metrics }
        };

        for (const session of this.sessions.values()) {
            const stats = session.server.getStats();
            sessionStats.push(stats);
            aggregate.clients += stats.clients || 0;
            aggregate.players += stats.players || 0;
            aggregate.teamAGauge += stats.teamAGauge || 0;
            aggregate.teamBGauge += stats.teamBGauge || 0;
            aggregate.maxGauge = Math.max(aggregate.maxGauge, stats.maxGauge || 0);
            aggregate.playersList.push(...(stats.playersList || []).map(player => ({
                ...player,
                sessionId: stats.sessionId
            })));
            aggregate.clickStats.total += (stats.clickStats && stats.clickStats.total) || 0;
            aggregate.clickStats.validated += (stats.clickStats && stats.clickStats.validated) || 0;
            aggregate.clickStats.rejected += (stats.clickStats && stats.clickStats.rejected) || 0;
        }

        const defaultStats = this.sessions.get(DEFAULT_SESSION_ID);
        if (defaultStats) {
            const stats = defaultStats.server.getStats();
            aggregate.phase = stats.phase;
            aggregate.stateHash = stats.stateHash;
            aggregate.maxGauge = stats.maxGauge;
            aggregate.victoryBroadcastMs = stats.victoryBroadcastMs;
            aggregate.latencyStats = stats.latencyStats;
            aggregate.victoryNotifStats = stats.victoryNotifStats;
        }

        return aggregate;
    }

    async shutdown() {
        for (const session of this.sessions.values()) {
            session.server.shutdown();
            if (session.store.disconnect) await session.store.disconnect();
        }
    }

    _relayBroadcast(session, message) {
        const json = JSON.stringify(message);
        session.server.clients.forEach((client) => {
            try {
                if (client.ws && client.ws.readyState === 1) {
                    client.ws.send(json);
                }
            } catch (_e) {
                // Broadcast errors are already best-effort in GameServer.
            }
        });
    }

    _sendSessionError(ws, code, sessionId, message) {
        this.metrics.sessionErrors++;
        this._send(ws, {
            type: 'session_error',
            code,
            sessionId: normalizeSessionId(sessionId),
            message,
            timestamp: Date.now()
        });
    }

    _send(ws, payload) {
        try {
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify(payload));
                return true;
            }
        } catch (_e) {
            return false;
        }
        return false;
    }

    _generateSessionId() {
        return crypto.randomUUID().slice(0, 8);
    }
}

module.exports = SessionManager;
