#!/usr/bin/env node

/**
 * ClickWars Territory - WebSocket Server with Game Logic
 * 
 * Serveur WebSocket avec logique de jeu intégrée.
 * Maintient l'état autoritaire du jeu et synchronise tous les clients.
 * 
 * Usage: node websocket-server.js [port]
 */

const WebSocket = require('ws');
const GameServer = require('./GameServer');

const PORT = process.argv[2] || 7777;

// Créer le serveur WebSocket
const wss = new WebSocket.Server({
    port: PORT,
    host: '0.0.0.0'  // Écouter sur toutes les interfaces réseau
});

// Créer l'instance du serveur de jeu
const gameServer = new GameServer();

// Compteur pour les IDs clients
let clientIdCounter = 0;

console.log(`🚀 ClickWars WebSocket Server démarré sur le port ${PORT}`);
console.log(`🎮 Serveur de jeu initialisé`);
console.log(`📡 En attente de connexions...`);
console.log(`💡 Les clients peuvent se connecter à ws://localhost:${PORT}\n`);

// Afficher les stats toutes les 10 secondes
setInterval(() => {
    const stats = gameServer.getStats();
    if (stats.players > 0) {
        console.log(`📊 Stats: ${stats.clients} clients | ${stats.players} joueurs | Phase: ${stats.phase} | Jauges: A=${stats.teamAGauge} B=${stats.teamBGauge}`);
    }
}, 10000);

wss.on('connection', (ws, req) => {
    // Générer un ID unique pour ce client
    const clientId = `client_${++clientIdCounter}`;
    const ip = req.socket.remoteAddress;

    // Ajouter le client au serveur de jeu
    gameServer.addClient(clientId, ws);

    console.log(`✅ Client connecté: ${clientId} (${ip})`);
    console.log(`👥 Clients connectés: ${gameServer.clients.size}\n`);

    // Gérer les messages reçus
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Message de ${clientId}:`, message.type || 'unknown');

            // Passer le message au serveur de jeu
            gameServer.handleMessage(clientId, message);

        } catch (error) {
            console.error(`❌ Erreur de parsing JSON de ${clientId}:`, error.message);
        }
    });

    // Gérer la déconnexion
    ws.on('close', () => {
        gameServer.removeClient(clientId);
        console.log(`❌ Client déconnecté: ${clientId}`);
        console.log(`👥 Clients connectés: ${gameServer.clients.size}\n`);
    });

    // Gérer les erreurs
    ws.on('error', (error) => {
        console.error(`⚠️  Erreur client ${clientId}:`, error.message);
    });
});

// Gérer l'arrêt propre du serveur
process.on('SIGINT', () => {
    console.log('\n\n🛑 Arrêt du serveur...');
    wss.close(() => {
        console.log('✨ Serveur arrêté proprement');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    wss.close(() => process.exit(0));
});
