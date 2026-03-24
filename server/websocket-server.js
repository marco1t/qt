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

const GAME_PORT = parseInt(process.env.GAME_PORT || '7777', 10);
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();

const TAG = `[instance:${INSTANCE_ID.slice(0, 8)}]`;
console.log(`${TAG} Starting up`);

// --- 1. Creer le store ---
const store = createStore(INSTANCE_ID);

// --- 2. Serveur HTTP pour le Dashboard ---
const httpServer = http.createServer((req, res) => {
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
    console.log(`${TAG} Dashboard on http://localhost:${DASHBOARD_PORT}`);
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
                console.error(`${TAG} Relay broadcast error:`, error.message);
            }
        });
    };

    // Connecter au Redis si c'est un RedisStore
    if (store.connect) {
        store.connect().then(() => {
            console.log(`${TAG} Redis pub/sub connected`);
        }).catch(err => {
            console.error(`${TAG} Redis connection failed:`, err.message);
        });
    }
}

// Metriques
let messagesPerSecond = 0;
const startTime = Date.now();

console.log(`${TAG} Game server on port ${GAME_PORT}`);

// --- Logique Dashboard ---
setInterval(async () => {
    const stats = gameServer.getStats();
    const used = process.memoryUsage().rss / 1024 / 1024;
    const localClients = stats.clients;
    const localMps = messagesPerSecond;

    let totalClients = localClients;
    let totalMps = localMps;
    let totalMemory = used;

    // Agregation multi-instances via Redis
    if (store.redis) {
        try {
            // 1. Publier les stats locales de cette instance
            await store.redis.hset('clickwars:instances:stats', INSTANCE_ID, JSON.stringify({
                clients: localClients,
                mps: localMps,
                memory: used,
                timestamp: Date.now()
            }));

            // 2. Recuperer le total
            const allStats = await store.redis.hgetall('clickwars:instances:stats');
            totalClients = 0; totalMps = 0; totalMemory = 0;
            const now = Date.now();

            for (const id in allStats) {
                const s = JSON.parse(allStats[id]);
                // Ignorer les instances mortes (plus de 5 secondes sans maj)
                if (now - s.timestamp < 5000) {
                    totalClients += s.clients || 0;
                    totalMps += s.mps || 0;
                    totalMemory += s.memory || 0;
                } else {
                    // Nettoyer les vieilles instances
                    store.redis.hdel('clickwars:instances:stats', id);
                }
            }
        } catch (error) {
            console.error(`${TAG} Stats aggregation error:`, error.message);
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
        instanceId: stats.instanceId
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

    gameServer.addClient(clientId, ws);
    console.log(`${TAG} Client connected: ${clientId} (IP: ${ip})`);

    ws.on('message', (data) => {
        messagesPerSecond++;

        try {
            const message = JSON.parse(data.toString());
            if (message.type !== 'click' && message.type !== 'ping' && message.type !== 'latency_report' && message.type !== 'victory_received') {
                console.log(`${TAG} Message from ${clientId}:`, message.type || 'unknown');
            }

            gameServer.handleMessage(clientId, message);

        } catch (error) {
            console.error(`${TAG} JSON error:`, error.message);
        }
    });

    ws.on('close', () => {
        const player = gameServer.getPlayer(clientId);
        const playerName = player ? player.name : clientId;

        gameServer.removeClient(clientId);
        console.log(`${TAG} Client disconnected: ${clientId}`);

        gameServer.broadcast({
            type: 'player_left',
            playerId: clientId,
            playerName: playerName,
            instanceId: INSTANCE_ID.slice(0, 8),
            message: `${playerName} a quitte la partie`,
            timestamp: Date.now()
        });
    });

    ws.on('error', (err) => console.error(`${TAG} Client error ${clientId}:`, err.message));
});

// Arret propre
process.on('SIGINT', async () => {
    console.log(`\n${TAG} Shutting down gracefully...`);
    gameWss.close();
    dashboardWss.close();
    httpServer.close();
    if (store.disconnect) await store.disconnect();
    process.exit(0);
});
