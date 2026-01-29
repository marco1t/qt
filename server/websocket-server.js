#!/usr/bin/env node

/**
 * ClickWars Territory - WebSocket Server with Game Logic & Monitoring
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const GameServer = require('./GameServer');

const GAME_PORT = 7777;
const DASHBOARD_PORT = 3000;

// --- 1. Serveur HTTP pour le Dashboard ---
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
    console.log(`📊 Dashboard accessible sur http://localhost:${DASHBOARD_PORT}`);
});

// --- 2. Serveurs WebSocket ---

// Serveur de JEU (Port 7777)
const gameWss = new WebSocket.Server({ port: GAME_PORT, host: '0.0.0.0' });

// Serveur pour le DASHBOARD (greffé sur le serveur HTTP 3000)
const dashboardWss = new WebSocket.Server({ server: httpServer, path: '/dashboard' });

const gameServer = new GameServer();
let clientIdCounter = 0;

// Métriques
let messagesPerSecond = 0;
const startTime = Date.now();

console.log(`🚀 ClickWars Game Server démarré sur le port ${GAME_PORT}`);

// --- Logique Dashboard ---
// Broadcast des stats au dashboard toutes les secondes
setInterval(() => {
    const stats = gameServer.getStats();

    // Calcul mémoire
    const used = process.memoryUsage().rss / 1024 / 1024;

    const data = {
        clients: stats.clients,
        players: stats.players,
        mps: messagesPerSecond,
        memory: Math.round(used * 100) / 100,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        teamAConfig: stats.teamAGauge, // Détourné pour afficher répartition ou score
        teamBConfig: stats.teamBGauge
    };

    // Envoyer à tous les dashboards connectés
    dashboardWss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

    // Reset compteur MPS
    if (messagesPerSecond > 0) {
        // console.log(`Stats: ${messagesPerSecond} mps`);
    }
    messagesPerSecond = 0;

}, 1000);


// --- Logique Jeu ---
gameWss.on('connection', (ws, req) => {
    const clientId = `client_${++clientIdCounter}`;
    const ip = req.socket.remoteAddress;

    gameServer.addClient(clientId, ws);
    console.log(`✅ Client connecté: ${clientId} (${ip})`);

    ws.on('message', (data) => {
        messagesPerSecond++; // Métrique

        try {
            const message = JSON.parse(data.toString());
            // gameServer.handleMessage appelé plus bas
            // Optionnel : ne pas logger chaque click en mode stress test pour préserver la console
            if (message.type !== 'click') {
                console.log(`📨 Message de ${clientId}:`, message.type || 'unknown');
            }

            gameServer.handleMessage(clientId, message);

        } catch (error) {
            console.error(`❌ Erreur JSON:`, error.message);
        }
    });

    ws.on('close', () => {
        const player = gameServer.getPlayer(clientId);
        const playerName = player ? player.name : clientId;

        gameServer.removeClient(clientId);
        console.log(`❌ Client déconnecté: ${clientId}`);

        gameServer.broadcast({
            type: 'player_left',
            playerId: clientId,
            playerName: playerName,
            message: `${playerName} a quitté la partie`,
            timestamp: Date.now()
        });
    });

    ws.on('error', (err) => console.error(`⚠️ Erreur client ${clientId}:`, err.message));
});

// Arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt des serveurs...');
    gameWss.close();
    dashboardWss.close();
    httpServer.close();
    process.exit(0);
});
