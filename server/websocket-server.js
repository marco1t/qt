#!/usr/bin/env node

/**
 * ClickWars Territory - WebSocket Server with Game Logic & Monitoring
 *
 * Supporte le multi-instances :
 * - Chaque instance a un UUID unique
 * - L'etat du jeu est delegue a un SharedStateStore
 * - Sans REDIS_URL : mode mono-instance (MemoryStore)
 * - Avec REDIS_URL : mode multi-instances (RedisStore + pub/sub)
 *
 * Variables d'environnement :
 *   GAME_PORT     - Port WebSocket du jeu (default: 7777)
 *   DASHBOARD_PORT - Port du dashboard HTTP (default: 3000)
 *   REDIS_URL     - URL Redis pour le multi-instances (optionnel)
 *   INSTANCE_ID   - ID de cette instance (auto-genere si absent)
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SessionManager = require('./SessionManager');
const RateLimiter = require('./RateLimiter');
const createLogger = require('./Logger');

const GAME_PORT = parseInt(process.env.GAME_PORT || '7777', 10);
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();
const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS || '2000', 10);
const DEGRADED_CLIENTS = parseInt(process.env.DEGRADED_CLIENTS || Math.floor(MAX_CLIENTS * 0.8), 10);
const OVERLOAD_MPS = parseInt(process.env.OVERLOAD_MPS || '5000', 10);
const DEGRADED_MPS = parseInt(process.env.DEGRADED_MPS || Math.floor(OVERLOAD_MPS * 0.8), 10);
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '1000', 10);
const RATE_MAX_MESSAGES = parseInt(process.env.RATE_MAX_MESSAGES || '120', 10);
const RATE_MAX_CLICKS = parseInt(process.env.RATE_MAX_CLICKS || '80', 10);
const RATE_MAX_JOINS = parseInt(process.env.RATE_MAX_JOINS || '5', 10);
const RATE_MAX_INVALID_JSON = parseInt(process.env.RATE_MAX_INVALID_JSON || '10', 10);
const RATE_MAX_PAYLOAD_BYTES = parseInt(process.env.RATE_MAX_PAYLOAD_BYTES || '4096', 10);
const RATE_ACTION_ID_TTL_MS = parseInt(process.env.RATE_ACTION_ID_TTL_MS || '30000', 10);
const RATE_CLOSE_ON_ABUSE = process.env.RATE_CLOSE_ON_ABUSE === 'true';

const SHORT_ID = INSTANCE_ID.slice(0, 8);
const TAG = `[instance:${SHORT_ID}]`;
const logger = createLogger(INSTANCE_ID);
logger.info('startup', { gamePort: GAME_PORT, dashboardPort: DASHBOARD_PORT });

// --- Metrics tracking for Prometheus ---
let totalMessagesReceived = 0;
let messageLatencySum = 0;
let messageLatencyCount = 0;

function getLoadStatus() {
    const stats = sessionManager ? sessionManager.getStats() : {};
    const clients = stats.clients || 0;
    const mps = messagesPerSecond || 0;

    if (clients >= MAX_CLIENTS || mps >= OVERLOAD_MPS) {
        return { state: 'overloaded', reason: clients >= MAX_CLIENTS ? 'max_clients' : 'message_rate', load: { clients, mps, maxClients: MAX_CLIENTS, maxMps: OVERLOAD_MPS } };
    }
    if (clients >= DEGRADED_CLIENTS || mps >= DEGRADED_MPS) {
        return { state: 'degraded', reason: clients >= DEGRADED_CLIENTS ? 'high_clients' : 'high_message_rate', load: { clients, mps, maxClients: MAX_CLIENTS, maxMps: OVERLOAD_MPS } };
    }
    return { state: 'healthy', reason: null, load: { clients, mps, maxClients: MAX_CLIENTS, maxMps: OVERLOAD_MPS } };
}

function generateMetrics() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const stats = sessionManager ? sessionManager.getStats() : {};
    const cs = stats.clickStats || {};
    const loadStatus = getLoadStatus();
    const rateMetrics = rateLimiter.getMetrics();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const avgLatency = messageLatencyCount > 0 ? (messageLatencySum / messageLatencyCount).toFixed(3) : 0;

    const metric = (name, type, help, value) =>
        `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name}{instance="${SHORT_ID}"} ${value}`;

    return [
        metric('clickwars_connected_players',      'gauge',   'Connected players',              stats.clients || 0),
        metric('clickwars_total_players',           'gauge',   'Total players including bots',   stats.players || 0),
        metric('clickwars_messages_per_second',     'gauge',   'Messages received per second',   messagesPerSecond),
        metric('clickwars_messages_total',          'counter', 'Total messages since startup',   totalMessagesReceived),
        metric('clickwars_message_latency_ms',      'gauge',   'Avg message handling latency',   avgLatency),
        metric('clickwars_memory_rss_bytes',        'gauge',   'Resident set size in bytes',     mem.rss),
        metric('clickwars_memory_heap_used_bytes',  'gauge',   'Heap used in bytes',             mem.heapUsed),
        metric('clickwars_memory_heap_total_bytes', 'gauge',   'Heap total in bytes',            mem.heapTotal),
        metric('clickwars_cpu_user_microseconds',   'counter', 'CPU user time microseconds',     cpu.user),
        metric('clickwars_cpu_system_microseconds', 'counter', 'CPU system time microseconds',   cpu.system),
        metric('clickwars_uptime_seconds',          'counter', 'Server uptime in seconds',       uptime),
        metric('clickwars_clicks_total',            'counter', 'Total clicks received',          cs.total || 0),
        metric('clickwars_clicks_validated',        'counter', 'Total validated clicks',         cs.validated || 0),
        metric('clickwars_clicks_rejected',         'counter', 'Total rejected clicks',          cs.rejected || 0),
        metric('clickwars_active_sessions',         'gauge',   'Active game sessions',           stats.activeSessions || 0),
        metric('clickwars_sessions_created_total',  'counter', 'Sessions created locally',       (stats.sessionMetrics && stats.sessionMetrics.sessionsCreated) || 0),
        metric('clickwars_sessions_restored_total', 'counter', 'Sessions restored locally',      (stats.sessionMetrics && stats.sessionMetrics.sessionsRestored) || 0),
        metric('clickwars_session_errors_total',    'counter', 'Session routing errors',         (stats.sessionMetrics && stats.sessionMetrics.sessionErrors) || 0),
        metric('clickwars_reconnect_attempts_total', 'counter', 'Player session reconnect attempts', (stats.sessionMetrics && stats.sessionMetrics.reconnectAttempts) || 0),
        metric('clickwars_server_overloaded',       'gauge',   'Server overload status',         loadStatus.state === 'overloaded' ? 1 : 0),
        metric('clickwars_server_degraded',         'gauge',   'Server degraded status',         loadStatus.state === 'degraded' ? 1 : 0),
        metric('clickwars_rate_limiter_enabled',    'gauge',   'Rate limiter enabled flag',       rateMetrics.enabled ? 1 : 0),
        metric('clickwars_rate_limiter_tracked_clients', 'gauge', 'Clients tracked by rate limiter', rateMetrics.trackedClients || 0),
        metric('clickwars_abuse_disconnects_total', 'counter', 'Connections closed by abuse prevention', rateMetrics.abuseDisconnects || 0),
        metric('clickwars_duplicate_actions_total', 'counter', 'Duplicate action IDs rejected',   rateMetrics.duplicateActions || 0),
        metric('clickwars_invalid_json_total',      'counter', 'Malformed JSON messages received', rateMetrics.invalidJson || 0),
        metric('clickwars_oversized_payloads_total', 'counter', 'Payloads rejected for size',      rateMetrics.oversizedPayloads || 0),
        metric('clickwars_gauge_a',                 'gauge',   'Gauge value for Team A',         stats.teamAGauge || 0),
        metric('clickwars_gauge_b',                 'gauge',   'Gauge value for Team B',         stats.teamBGauge || 0),
        '# HELP clickwars_rate_limited_total Messages rejected by abuse prevention reason',
        '# TYPE clickwars_rate_limited_total counter',
        ...Object.entries(rateMetrics.limitedByReason || {}).map(([reason, value]) =>
            `clickwars_rate_limited_total{instance="${SHORT_ID}",reason="${reason}"} ${value}`),
        '# HELP clickwars_connection_events_total Connection lifecycle events by type',
        '# TYPE clickwars_connection_events_total counter',
        ...Object.entries(connectionEventCounts).map(([t, v]) =>
            `clickwars_connection_events_total{instance="${SHORT_ID}",type="${t}"} ${v}`),
    ].join('\n') + '\n';
}

// --- 2. Serveur HTTP pour le Dashboard ---
const httpServer = http.createServer((req, res) => {
    if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', instanceId: SHORT_ID }));
        return;
    }
    if (req.url === '/readyz') {
        const ready = sessionManager && sessionManager.isReady();
        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', instanceId: SHORT_ID }));
        return;
    }
    if (req.url === '/metrics') {
        res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-cache'
        });
        res.end(generateMetrics());
        return;
    }
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'dashboard.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("Erreur chargement dashboard");
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

httpServer.listen(DASHBOARD_PORT, () => {
    logger.info('dashboard_ready', { port: DASHBOARD_PORT, metricsUrl: `/metrics` });
});

// --- 3. Serveurs WebSocket ---

// Serveur de JEU
const gameWss = new WebSocket.Server({ port: GAME_PORT, host: '0.0.0.0' });

// Serveur pour le DASHBOARD (greffe sur le serveur HTTP)
const dashboardWss = new WebSocket.Server({ server: httpServer, path: '/dashboard' });

// Metriques
let messagesPerSecond = 0;
const startTime = Date.now();

const rateLimiter = new RateLimiter({
    enabled: RATE_LIMIT_ENABLED,
    windowMs: RATE_WINDOW_MS,
    maxMessages: RATE_MAX_MESSAGES,
    maxClicks: RATE_MAX_CLICKS,
    maxJoins: RATE_MAX_JOINS,
    maxInvalidJson: RATE_MAX_INVALID_JSON,
    maxPayloadBytes: RATE_MAX_PAYLOAD_BYTES,
    actionIdTtlMs: RATE_ACTION_ID_TTL_MS,
    closeOnAbuse: RATE_CLOSE_ON_ABUSE
});
logger.info('rate_limiter_configured', rateLimiter.getConfig());
const rateLimiterCleanupInterval = setInterval(() => rateLimiter.cleanup(), Math.max(RATE_WINDOW_MS, 5000));
if (rateLimiterCleanupInterval.unref) rateLimiterCleanupInterval.unref();

// --- 4. Initialiser le SessionManager ---
const sessionManager = new SessionManager({
    instanceId: INSTANCE_ID,
    redisUrl: process.env.REDIS_URL,
    isOverloaded: () => getLoadStatus().state === 'overloaded'
});

let ready = false;
sessionManager.initDefault().then(() => {
    ready = true;
    logger.info('sessions_ready', { defaultSession: 'default', redisUrl: process.env.REDIS_URL || null });
}).catch(err => {
    logger.error('sessions_ready_failed', { error: err.message });
});

// --- Connection lifecycle tracking ---
const connectionEvents = [];       // recent events (max 200)
const MAX_EVENTS = 200;
const knownClients = new Map();    // clientId -> { ip, connectedAt, playerName }
const recentIPs = new Map();       // ip -> { clientId, playerName, disconnectedAt }
const connectionEventCounts = { connect: 0, disconnect: 0, reconnect: 0, error: 0 };

function addConnectionEvent(event) {
    event.timestamp = Date.now();
    event.instanceId = SHORT_ID;
    connectionEvents.push(event);
    if (connectionEvents.length > MAX_EVENTS) connectionEvents.shift();
    if (connectionEventCounts[event.type] !== undefined) connectionEventCounts[event.type]++;
    logger.info(`lifecycle:${event.type}`, {
        clientId: event.clientId,
        ip: event.ip,
        ...(event.code && { code: event.code }),
        ...(event.reason && { reason: event.reason }),
        ...(event.sessionDuration && { sessionDuration: event.sessionDuration }),
        ...(event.downtime && { downtime: event.downtime }),
        ...(event.playerName && { playerName: event.playerName }),
        summary: event.summary
    });

    // Push to dashboard clients immediately
    const msg = JSON.stringify({ type: 'connection_event', event });
    dashboardWss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

// WebSocket close code meanings
const CLOSE_REASONS = {
    1000: 'Normal close', 1001: 'Going away (page closed)', 1002: 'Protocol error',
    1003: 'Unsupported data', 1005: 'No code provided', 1006: 'Connection lost (no close frame)',
    1007: 'Invalid data', 1008: 'Policy violation', 1009: 'Message too big',
    1010: 'Extension required', 1011: 'Internal server error', 1012: 'Service restart',
    1013: 'Try again later', 1015: 'TLS handshake failed',
};
const closeReason = (code) => CLOSE_REASONS[code] || `Unknown (${code})`;

logger.info('game_server_ready', { port: GAME_PORT });

function handleRateLimit(clientId, ws, decision) {
    logger.warn('rate_limited', {
        clientId,
        code: decision.code,
        retryAfterMs: decision.retryAfterMs,
        close: decision.close
    });

    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'rate_limited',
                code: decision.code,
                message: decision.message,
                retryAfterMs: decision.retryAfterMs,
                timestamp: Date.now()
            }));
            if (decision.close) {
                rateLimiter.recordAbuseDisconnect();
                ws.close(1008, decision.code);
            }
        }
    } catch (error) {
        logger.warn('rate_limit_send_failed', { clientId, error: error.message });
    }
}

function rawByteLength(data) {
    if (Buffer.isBuffer(data)) return data.length;
    if (typeof data === 'string') return Buffer.byteLength(data);
    if (data && typeof data.byteLength === 'number') return data.byteLength;
    return Buffer.byteLength(String(data || ''));
}

// --- Logique Dashboard ---
setInterval(async () => {
    const stats = sessionManager.getStats();
    const loadStatus = getLoadStatus();
    const used = process.memoryUsage().rss / 1024 / 1024;
    const localClients = stats.clients;
    const localMps = messagesPerSecond;

    let totalClients = localClients;
    let totalMps = localMps;
    let totalMemory = used;
    let activeInstances = [{
        id: SHORT_ID,
        clients: localClients,
        mps: localMps,
        memory: Math.round(used * 100) / 100,
        uptime: Math.floor((Date.now() - startTime) / 1000)
    }];

    // Agregation multi-instances via Redis
    const statsRedis = sessionManager.redis;
    if (statsRedis) {
        try {
            // 1. Publier les stats locales de cette instance
            await statsRedis.hset('clickwars:instances:stats', INSTANCE_ID, JSON.stringify({
                clients: localClients,
                mps: localMps,
                memory: used,
                uptime: Math.floor((Date.now() - startTime) / 1000),
                timestamp: Date.now()
            }));

            // 2. Recuperer le total + liste des instances actives
            const allStats = await statsRedis.hgetall('clickwars:instances:stats');
            totalClients = 0; totalMps = 0; totalMemory = 0;
            activeInstances = [];
            const now = Date.now();

            for (const id in allStats) {
                const s = JSON.parse(allStats[id]);
                // Ignorer les instances mortes (plus de 5 secondes sans maj)
                if (now - s.timestamp < 5000) {
                    totalClients += s.clients || 0;
                    totalMps += s.mps || 0;
                    totalMemory += s.memory || 0;
                    activeInstances.push({
                        id: id.slice(0, 8),
                        clients: s.clients || 0,
                        mps: s.mps || 0,
                        memory: Math.round((s.memory || 0) * 100) / 100,
                        uptime: s.uptime || 0
                    });
                } else {
                    // Nettoyer les vieilles instances
                    statsRedis.hdel('clickwars:instances:stats', id);
                }
            }
        } catch (error) {
            logger.error('stats_aggregation_error', { error: error.message });
        }
    }

    const data = {
        clients: totalClients,
        players: stats.players,
        mps: totalMps,
        memory: Math.round(totalMemory * 100) / 100,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        teamAConfig: stats.teamAGauge,
        teamBConfig: stats.teamBGauge,
        playersList: stats.playersList,
        clickStats: stats.clickStats,
        maxGauge: stats.maxGauge,
        phase: stats.phase,
        victoryBroadcastMs: stats.victoryBroadcastMs,
        latencyStats: stats.latencyStats,
        victoryNotifStats: stats.victoryNotifStats,
        instanceId: stats.instanceId,
        activeSessions: stats.activeSessions,
        sessions: stats.sessions,
        serverStatus: loadStatus.state,
        activeInstances: activeInstances,
        connectionEvents: connectionEvents.slice(-50)
    };

    dashboardWss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

    if (localMps > 0) {
        // console.log(`Stats locales: ${localMps} mps`);
    }
    messagesPerSecond = 0;
    if (loadStatus.state !== 'healthy') {
        sessionManager.broadcastServerStatus(loadStatus);
    }

}, 1000);


// --- Logique Jeu ---
gameWss.on('connection', (ws, req) => {
    // UUID globalement unique (pas de collision entre instances)
    const clientId = `client_${SHORT_ID}_${crypto.randomUUID().slice(0, 8)}`;
    const ip = req.socket.remoteAddress;
    const connectedAt = Date.now();

    // Reconnection detection: check if this IP recently disconnected
    const previousSession = recentIPs.get(ip);
    const isReconnect = previousSession && (connectedAt - previousSession.disconnectedAt < 30000);

    knownClients.set(clientId, { ip, connectedAt, playerName: null });

    if (isReconnect) {
        addConnectionEvent({
            type: 'reconnect',
            clientId,
            ip,
            previousClientId: previousSession.clientId,
            previousPlayerName: previousSession.playerName,
            downtime: connectedAt - previousSession.disconnectedAt,
            summary: `${previousSession.playerName || ip} reconnected after ${Math.round((connectedAt - previousSession.disconnectedAt) / 1000)}s (was ${previousSession.clientId.slice(-8)}, now ${clientId.slice(-8)})`
        });
    } else {
        addConnectionEvent({
            type: 'connect',
            clientId,
            ip,
            summary: `New connection ${clientId.slice(-8)} from ${ip}`
        });
    }

    ws.on('message', async (data) => {
        const msgStart = Date.now();
        messagesPerSecond++;
        totalMessagesReceived++;

        const rawDecision = rateLimiter.checkRaw(clientId, rawByteLength(data));
        if (!rawDecision.allowed) {
            handleRateLimit(clientId, ws, rawDecision);
            return;
        }

        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            const invalidDecision = rateLimiter.checkInvalidJson(clientId);
            if (!invalidDecision.allowed) {
                handleRateLimit(clientId, ws, invalidDecision);
            }
            logger.error('json_parse_error', { clientId, error: error.message });
            return;
        }

        const rateDecision = rateLimiter.checkMessage(clientId, message);
        if (!rateDecision.allowed) {
            handleRateLimit(clientId, ws, rateDecision);
            return;
        }

        try {
            // Track player name for lifecycle logs
            if (message.type === 'player_join' && message.name) {
                const info = knownClients.get(clientId);
                if (info) info.playerName = message.name;
                logger.info('player_join', { clientId, playerName: message.name, playerId: message.playerId });
            }

            if (message.type !== 'click' && message.type !== 'ping' && message.type !== 'latency_report' && message.type !== 'victory_received') {
                logger.info('message', { clientId, type: message.type || 'unknown' });
            }

            await sessionManager.handleMessage(clientId, ws, message);

            // Track latency
            const latency = Date.now() - msgStart;
            messageLatencySum += latency;
            messageLatencyCount++;

        } catch (error) {
            logger.error('message_handling_error', { clientId, type: message.type || 'unknown', error: error.message });
        }
    });

    ws.on('close', (code, reason) => {
        const sessionInfo = sessionManager.getClientSessionInfo(clientId);
        const info = knownClients.get(clientId) || {};
        const playerName = (sessionInfo && sessionInfo.playerName) || info.playerName || clientId;
        const sessionDuration = Date.now() - connectedAt;

        // Store for reconnection detection
        recentIPs.set(ip, {
            clientId,
            playerName,
            disconnectedAt: Date.now()
        });

        const removedSession = sessionManager.removeClient(clientId);
        rateLimiter.cleanupClient(clientId);
        knownClients.delete(clientId);

        addConnectionEvent({
            type: 'disconnect',
            clientId,
            ip,
            playerName,
            code: code || 1005,
            reason: closeReason(code || 1005),
            sessionDuration,
            summary: `${playerName} disconnected — ${closeReason(code || 1005)} (session: ${Math.round(sessionDuration / 1000)}s)`
        });

        if (removedSession) {
            sessionManager.broadcastToSession(removedSession.sessionId, {
            type: 'player_left',
            playerId: (removedSession && removedSession.playerId) || clientId,
            playerName: playerName,
            instanceId: SHORT_ID,
            sessionId: removedSession.sessionId,
            message: `${playerName} a quitte la partie`,
            timestamp: Date.now()
            });
        }
    });

    ws.on('error', (err) => {
        addConnectionEvent({
            type: 'error',
            clientId,
            ip,
            error: err.message,
            summary: `Error on ${clientId.slice(-8)}: ${err.message}`
        });
    });
});

// Arret propre
process.on('SIGINT', async () => {
    logger.info('shutdown', { reason: 'SIGINT' });
    await sessionManager.shutdown();
    clearInterval(rateLimiterCleanupInterval);
    gameWss.close();
    dashboardWss.close();
    httpServer.close();
    process.exit(0);
});
