#!/usr/bin/env node

/**
 * ClickWars Territory - WebSocket Server
 * 
 * Serveur WebSocket simple pour le multijoueur LAN.
 * Lance ce serveur avant de démarrer le jeu.
 * 
 * Usage: node websocket-server.js [port]
 */

const WebSocket = require('ws');
const PORT = process.argv[2] || 7777;

// Créer le serveur WebSocket
const wss = new WebSocket.Server({
    port: PORT,
    host: '0.0.0.0'  // Écouter sur toutes les interfaces réseau
});

// Stocker les clients connectés
const clients = new Map();
let clientIdCounter = 0;

console.log(`🚀 ClickWars WebSocket Server démarré sur le port ${PORT}`);
console.log(`📡 En attente de connexions...`);
console.log(`💡 Les clients peuvent se connecter à ws://localhost:${PORT}\n`);

wss.on('connection', (ws, req) => {
    // Générer un ID unique pour ce client
    const clientId = `client_${++clientIdCounter}`;
    const ip = req.socket.remoteAddress;

    clients.set(clientId, ws);
    console.log(`✅ Client connecté: ${clientId} (${ip})`);
    console.log(`👥 Clients connectés: ${clients.size}\n`);

    // Gérer les messages reçus
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Message de ${clientId}:`, message.type || 'unknown');

            // Relayer le message à tous les autres clients
            clients.forEach((client, id) => {
                if (id !== clientId && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        ...message,
                        senderId: clientId
                    }));
                }
            });
        } catch (error) {
            console.error(`❌ Erreur de parsing JSON de ${clientId}:`, error.message);
        }
    });

    // Gérer la déconnexion
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`❌ Client déconnecté: ${clientId}`);
        console.log(`👥 Clients connectés: ${clients.size}\n`);
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
