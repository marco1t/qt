#!/usr/bin/env node
/**
 * reset.js - Reset a running ClickWars session remotely.
 *
 * Usage local : node reset.js
 * Usage prod  : SERVER_URL=wss://clickwars-ws.3sigma-studios.com node reset.js
 * Session     : SESSION_ID=my-session node reset.js
 */

const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:7777';
const SESSION_ID = process.env.SESSION_ID || 'default';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10);

console.log(`Connexion a ${SERVER_URL}...`);
console.log(`Session cible: ${SESSION_ID}`);

const ws = new WebSocket(SERVER_URL);
const timeout = setTimeout(() => {
    console.error('Timeout - serveur inaccessible');
    process.exit(1);
}, REQUEST_TIMEOUT_MS);

ws.on('open', () => {
    console.log('Connecte. Envoi reset_game...');
    ws.send(JSON.stringify({ type: 'reset_game', sessionId: SESSION_ID }));
    setTimeout(() => {
        clearTimeout(timeout);
        console.log('Partie remise a zero.');
        ws.close();
        process.exit(0);
    }, 500);
});

ws.on('error', (e) => {
    clearTimeout(timeout);
    console.error(`Erreur : ${e.message}`);
    process.exit(1);
});
