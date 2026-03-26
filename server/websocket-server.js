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
const GameServer = require('./GameServer');
const { createStore } = require('./SharedStateStore');
const createLogger = require('./Logger');

const GAME_PORT = parseInt(process.env.GAME_PORT || '7777', 10);
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();

const TAG = `[instance:${INSTANCE_ID.slice(0, 8)}]`;
const logger = createLogger(INSTANCE_ID);
logger.info('startup', { gamePort: GAME_PORT, dashboardPort: DASHBOARD_PORT });

// --- 1. Creer le store ---
const store = createStore(INSTANCE_ID);

// --- Metrics tracking for Prometheus ---
let totalMessagesReceived = 0;
let messageLatencySum = 0;
let messageLatencyCount = 0;

function generateMetrics() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const stats = gameServer ? gameServer.getStats() : {};
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const avgLatency = messageLatencyCount > 0 ? (messageLatencySum / messageLatencyCount).toFixed(3) : 0;

    return [
        '# HELP clickwars_connected_players Number of currently connected players',
        '# TYPE clickwars_connected_players gauge',
        `clickwars_connected_players{instance="${INSTANCE_ID.slice(0,8)}"} ${stats.clients || 0}`,
        '',
        '# HELP clickwars_total_players Total players in game (including bots)',
        '# TYPE clickwars_total_players gauge',
        `clickwars_total_players{instance="${INSTANCE_ID.slice(0,8)}"} ${stats.players || 0}`,
        '',
        '# HELP clickwars_messages_per_second Messages received per second',
        '# TYPE clickwars_messages_per_second gauge',
        `clickwars_messages_per_second{instance="${INSTANCE_ID.slice(0,8)}"} ${messagesPerSecond}`,
        '',
        '# HELP clickwars_messages_total Total messages received since startup',
        '# TYPE clickwars_messages_total counter',
        `clickwars_messages_total{instance="${INSTANCE_ID.slice(0,8)}"} ${totalMessagesReceived}`,
        '',
        '# HELP clickwars_message_latency_ms Average message handling latency in ms',
        '# TYPE clickwars_message_latency_ms gauge',
        `clickwars_message_latency_ms{instance="${INSTANCE_ID.slice(0,8)}"} ${avgLatency}`,
        '',
        '# HELP clickwars_memory_rss_bytes Resident set size in bytes',
        '# TYPE clickwars_memory_rss_bytes gauge',
        `clickwars_memory_rss_bytes{instance="${INSTANCE_ID.slice(0,8)}"} ${mem.rss}`,
        '',
        '# HELP clickwars_memory_heap_used_bytes Heap used in bytes',
        '# TYPE clickwars_memory_heap_used_bytes gauge',
        `clickwars_memory_heap_used_bytes{instance="${INSTANCE_ID.slice(0,8)}"} ${mem.heapUsed}`,
        '',
        '# HELP clickwars_memory_heap_total_bytes Heap total in bytes',
        '# TYPE clickwars_memory_heap_total_bytes gauge',
        `clickwars_memory_heap_total_bytes{instance="${INSTANCE_ID.slice(0,8)}"} ${mem.heapTotal}`,
        '',
        '# HELP clickwars_cpu_user_microseconds CPU user time in microseconds',
        '# TYPE clickwars_cpu_user_microseconds counter',
        `clickwars_cpu_user_microseconds{instance="${INSTANCE_ID.slice(0,8)}"} ${cpu.user}`,
        '',
        '# HELP clickwars_cpu_system_microseconds CPU system time in microseconds',
        '# TYPE clickwars_cpu_system_microseconds counter',
        `clickwars_cpu_system_microseconds{instance="${INSTANCE_ID.slice(0,8)}"} ${cpu.system}`,
        '',
        '# HELP clickwars_uptime_seconds Server uptime in seconds',
        '# TYPE clickwars_uptime_seconds counter',
        `clickwars_uptime_seconds{instance="${INSTANCE_ID.slice(0,8)}"} ${uptime}`,
        '',
        '# HELP clickwars_clicks_total Total clicks received',
        '# TYPE clickwars_clicks_total counter',
        `clickwars_clicks_total{instance="${INSTANCE_ID.slice(0,8)}"} ${(stats.clickStats && stats.clickStats.total) || 0}`,
        '',
        '# HELP clickwars_clicks_validated Total validated clicks',
        '# TYPE clickwars_clicks_validated counter',
        `clickwars_clicks_validated{instance="${INSTANCE_ID.slice(0,8)}"} ${(stats.clickStats && stats.clickStats.validated) || 0}`,
        '',
        '# HELP clickwars_clicks_rejected Total rejected clicks',
        '# TYPE clickwars_clicks_rejected counter',
        `clickwars_clicks_rejected{instance="${INSTANCE_ID.slice(0,8)}"} ${(stats.clickStats && stats.clickStats.rejected) || 0}`,
        '',
        '# HELP clickwars_gauge_a Current gauge value for Team A',
        '# TYPE clickwars_gauge_a gauge',
        `clickwars_gauge_a{instance="${INSTANCE_ID.slice(0,8)}"} ${stats.teamAGauge || 0}`,
        '',
        '# HELP clickwars_gauge_b Current gauge value for Team B',
        '# TYPE clickwars_gauge_b gauge',
        `clickwars_gauge_b{instance="${INSTANCE_ID.slice(0,8)}"} ${stats.teamBGauge || 0}`,
        '',
        '# HELP clickwars_connection_events_total Connection lifecycle events by type',
        '# TYPE clickwars_connection_events_total counter',
        `clickwars_connection_events_total{instance="${INSTANCE_ID.slice(0,8)}",type="connect"} ${connectionEventCounts.connect}`,
        `clickwars_connection_events_total{instance="${INSTANCE_ID.slice(0,8)}",type="disconnect"} ${connectionEventCounts.disconnect}`,
        `clickwars_connection_events_total{instance="${INSTANCE_ID.slice(0,8)}",type="reconnect"} ${connectionEventCounts.reconnect}`,
        `clickwars_connection_events_total{instance="${INSTANCE_ID.slice(0,8)}",type="error"} ${connectionEventCounts.error}`,
        '',
    ].join('\n');
}

// --- 2. Serveur HTTP pour le Dashboard ---
const httpServer = http.createServer((req, res) => {
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

// --- 4. Initialiser le GameServer avec le store ---
const gameServer = new GameServer(store, INSTANCE_ID);

// Si Redis est configure, ecouter les broadcasts des autres instances
if (store.onBroadcastReceived !== undefined) {
    store.onBroadcastReceived = (message) => {
        // Relayer le broadcast aux clients locaux de cette instance
        const json = JSON.stringify(message);
        gameServer.clients.forEach((client) => {
            try {
                if (client.ws && client.ws.readyState === 1) {
                    client.ws.send(json);
                }
            } catch (error) {
                logger.error('relay_broadcast_error', { error: error.message });
            }
        });
    };

    // Connecter au Redis si c'est un RedisStore
    if (store.connect) {
        store.connect().then(() => {
            logger.info('redis_connected', { url: process.env.REDIS_URL });
        }).catch(err => {
            logger.error('redis_connection_failed', { error: err.message });
        });
    }
}

// Metriques
let messagesPerSecond = 0;
const startTime = Date.now();

// --- Connection lifecycle tracking ---
const connectionEvents = [];       // recent events (max 200)
const MAX_EVENTS = 200;
const knownClients = new Map();    // clientId -> { ip, connectedAt, playerName }
const recentIPs = new Map();       // ip -> { clientId, playerName, disconnectedAt }
const connectionEventCounts = { connect: 0, disconnect: 0, reconnect: 0, error: 0 };

function addConnectionEvent(event) {
    event.timestamp = Date.now();
    event.instanceId = INSTANCE_ID.slice(0, 8);
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
function closeReason(code) {
    const reasons = {
        1000: 'Normal close',
        1001: 'Going away (page closed)',
        1002: 'Protocol error',
        1003: 'Unsupported data',
        1005: 'No code provided',
        1006: 'Connection lost (no close frame)',
        1007: 'Invalid data',
        1008: 'Policy violation',
        1009: 'Message too big',
        1010: 'Extension required',
        1011: 'Internal server error',
        1012: 'Service restart',
        1013: 'Try again later',
        1015: 'TLS handshake failed',
    };
    return reasons[code] || `Unknown (${code})`;
}

logger.info('game_server_ready', { port: GAME_PORT });

// --- Logique Dashboard ---
setInterval(async () => {
    const stats = gameServer.getStats();
    const used = process.memoryUsage().rss / 1024 / 1024;
    const localClients = stats.clients;
    const localMps = messagesPerSecond;

    let totalClients = localClients;
    let totalMps = localMps;
    let totalMemory = used;
    let activeInstances = [{
        id: INSTANCE_ID.slice(0, 8),
        clients: localClients,
        mps: localMps,
        memory: Math.round(used * 100) / 100,
        uptime: Math.floor((Date.now() - startTime) / 1000)
    }];

    // Agregation multi-instances via Redis
    if (store.redis) {
        try {
            // 1. Publier les stats locales de cette instance
            await store.redis.hset('clickwars:instances:stats', INSTANCE_ID, JSON.stringify({
                clients: localClients,
                mps: localMps,
                memory: used,
                uptime: Math.floor((Date.now() - startTime) / 1000),
                timestamp: Date.now()
            }));

            // 2. Recuperer le total + liste des instances actives
            const allStats = await store.redis.hgetall('clickwars:instances:stats');
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
                    store.redis.hdel('clickwars:instances:stats', id);
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

}, 1000);


// --- Logique Jeu ---
gameWss.on('connection', (ws, req) => {
    // UUID globalement unique (pas de collision entre instances)
    const clientId = `client_${INSTANCE_ID.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`;
    const ip = req.socket.remoteAddress;
    const connectedAt = Date.now();

    // Reconnection detection: check if this IP recently disconnected
    const previousSession = recentIPs.get(ip);
    const isReconnect = previousSession && (connectedAt - previousSession.disconnectedAt < 30000);

    gameServer.addClient(clientId, ws);
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

    ws.on('message', (data) => {
        const msgStart = Date.now();
        messagesPerSecond++;
        totalMessagesReceived++;

        try {
            const message = JSON.parse(data.toString());

            // Track player name for lifecycle logs
            if (message.type === 'player_join' && message.name) {
                const info = knownClients.get(clientId);
                if (info) info.playerName = message.name;
                logger.info('player_join', { clientId, playerName: message.name, playerId: message.playerId });
            }

            if (message.type !== 'click' && message.type !== 'ping' && message.type !== 'latency_report' && message.type !== 'victory_received') {
                logger.info('message', { clientId, type: message.type || 'unknown' });
            }

            gameServer.handleMessage(clientId, message);

            // Track latency
            const latency = Date.now() - msgStart;
            messageLatencySum += latency;
            messageLatencyCount++;

        } catch (error) {
            logger.error('json_parse_error', { clientId, error: error.message });
        }
    });

    ws.on('close', (code, reason) => {
        const player = gameServer.getPlayer(clientId);
        const info = knownClients.get(clientId) || {};
        const playerName = (player && player.name) || info.playerName || clientId;
        const sessionDuration = Date.now() - connectedAt;

        // Store for reconnection detection
        recentIPs.set(ip, {
            clientId,
            playerName,
            disconnectedAt: Date.now()
        });

        gameServer.removeClient(clientId);
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

        gameServer.broadcast({
            type: 'player_left',
            playerId: clientId,
            playerName: playerName,
            instanceId: INSTANCE_ID.slice(0, 8),
            message: `${playerName} a quitte la partie`,
            timestamp: Date.now()
        });
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
    gameWss.close();
    dashboardWss.close();
    httpServer.close();
    if (store.disconnect) await store.disconnect();
    process.exit(0);
});
