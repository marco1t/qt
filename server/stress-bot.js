#!/usr/bin/env node

/**
 * stress-bot.js - Bot de stress test INDÉPENDANT
 *
 * Chaque instance de ce script est UN bot autonome avec sa propre connexion WebSocket.
 * Il envoie une quantité massive de clics pour tester les limites du serveur.
 *
 * Usage:
 *   node stress-bot.js                         → Bot auto-équilibré, 1000 clics/batch
 *   node stress-bot.js --team A --rate 5000    → Équipe A, 5000 clics toutes les 0.5s
 *   node stress-bot.js --team B --rate 10000   → Équipe B, 10 000 clics par batch
 *   node stress-bot.js --name "SuperBot"       → Nom personnalisé
 *   node stress-bot.js --host 192.168.1.50     → Serveur distant
 *   node stress-bot.js --port 8080             → Port personnalisé
 *   node stress-bot.js --duration 30           → Durée max en secondes (défaut: infini)
 *
 * Lancer plusieurs bots simultanément :
 *   for /L %i in (1,1,10) do start /B node stress-bot.js --team A --rate 5000
 */

const WebSocket = require('ws');

// =============================================
// ARGUMENTS
// =============================================
const args = process.argv.slice(2);

function getArg(name, defaultValue) {
    const idx = args.indexOf('--' + name);
    if (idx >= 0 && args[idx + 1]) {
        return args[idx + 1];
    }
    return defaultValue;
}

const HOST = getArg('host', 'localhost');
const PORT = parseInt(getArg('port', '7777'));
const TEAM = getArg('team', null); // null = auto-balance
const BOT_NAME = getArg('name', 'StressBot_' + Math.floor(Math.random() * 10000));
const CLICKS_PER_BATCH = parseInt(getArg('rate', '250'));
const BATCH_INTERVAL_MS = parseInt(getArg('interval', '500')); // Toutes les 500ms
// Chaque bot a un rythme légèrement différent (±30%)
const ACTUAL_INTERVAL = Math.floor(BATCH_INTERVAL_MS * (0.7 + Math.random() * 0.6));
const MAX_DURATION = parseInt(getArg('duration', '0')); // 0 = infini

const URL = `ws://${HOST}:${PORT}`;

// =============================================
// ÉTAT
// =============================================
let playerId = null;
let isPlaying = false;
let totalSent = 0;
let totalValidated = 0;
let totalRejected = 0;
let batchCount = 0;
let startTime = null;
let clickInterval = null;

// =============================================
// AFFICHAGE
// =============================================
function log(emoji, msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${emoji} [${BOT_NAME}] ${msg}`);
}

function printStats() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(totalSent / parseFloat(elapsed));
    log('📊', `Envoyés: ${totalSent.toLocaleString()} | Batches: ${batchCount} | Durée: ${elapsed}s | Débit: ${rate} clics/s`);
}

// =============================================
// CONNEXION
// =============================================
log('🔌', `Connexion à ${URL}...`);

const ws = new WebSocket(URL);

ws.on('open', () => {
    log('✅', `Connecté au serveur`);

    // Étape 1 : Rejoindre en tant que joueur
    playerId = 'stress_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const joinMsg = {
        type: 'player_join',
        playerId: playerId,
        name: BOT_NAME,
    };

    // Si une équipe est spécifiée, on ajoute comme bot dans cette équipe
    if (TEAM) {
        const normalizedTeam = TEAM.toUpperCase();
        let team = normalizedTeam;
        if (normalizedTeam === 'ROUGE' || normalizedTeam === 'RED') team = 'A';
        if (normalizedTeam === 'BLEU' || normalizedTeam === 'BLUE') team = 'B';
        joinMsg.team = team;
    }

    ws.send(JSON.stringify(joinMsg));
    log('👤', `Joueur enregistré: ${BOT_NAME} (${playerId}) | Équipe: ${TEAM || 'auto'}`);
    log('⏳', `En attente du démarrage de la partie...`);
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());

        // Détecter le passage en phase "playing"
        if (msg.type === 'state_update' || msg.type === 'lobby_update') {
            if (msg.phase === 'playing' && !isPlaying) {
                isPlaying = true;
                startTime = Date.now();
                log('🎮', `PARTIE DÉMARRÉE ! Envoi de ${CLICKS_PER_BATCH.toLocaleString()} clics toutes les ${BATCH_INTERVAL_MS}ms`);
                startClicking();
            } else if (msg.phase === 'lobby' && isPlaying) {
                // Reset after game
                isPlaying = false;
                stopClicking();
                log('🔄', `Partie terminée → retour au lobby`);
                printStats();
            }
        }

        // Victoire détectée - on simule le délai réseau réaliste
        if (msg.type === 'victory') {
            log('🏆', `═══════════════════════════════════════`);
            log('🏆', `VICTOIRE : Équipe ${msg.winner} !`);

            if (msg.clickStats) {
                totalValidated = msg.clickStats.validated;
                totalRejected = msg.clickStats.rejected;
                log('📊', `Total serveur  : ${msg.clickStats.total.toLocaleString()}`);
                log('✅', `Validés        : ${msg.clickStats.validated.toLocaleString()}`);
                log('👻', `Rejetés (latence): ${msg.clickStats.rejected.toLocaleString()}`);
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            const rate = Math.round(totalSent / parseFloat(elapsed));

            log('📊', `───────────────────────────────────────`);
            log('📤', `Clics envoyés par MOI: ${totalSent.toLocaleString()}`);
            log('⚡', `Débit moyen   : ${rate.toLocaleString()} clics/s`);
            log('⏱️', `Durée         : ${elapsed}s`);
            log('📦', `Batches       : ${batchCount}`);
            log('🏆', `═══════════════════════════════════════`);

            // Simuler un joueur réel : continue de cliquer brièvement après réception victoire
            // (temps de réaction humain)
            log('🔄', `Continue de cliquer pendant 0.5s (simulation latence)...`);
            setTimeout(() => {
                log('🛑', `Arrêt des clics (victoire reçue)`);
                stopClicking();
                printStats();
                ws.close();
            }, 500);
        }

    } catch (e) {
        // Ignorer les messages non-JSON
    }
});

ws.on('close', () => {
    log('🔌', `Déconnecté du serveur`);
    stopClicking();
    process.exit(0);
});

ws.on('error', (err) => {
    log('❌', `Erreur: ${err.message}`);
    process.exit(1);
});

// =============================================
// ENVOI MASSIF DE CLICS
// =============================================
function startClicking() {
    if (clickInterval) return;

    clickInterval = setInterval(() => {
        // On continue même après victoire (pour mesurer la latence)
        if (ws.readyState !== WebSocket.OPEN) {
            stopClicking();
            return;
        }

        // Nombre aléatoire de clics par batch (±50% variation)
        const randomClicks = Math.floor(CLICKS_PER_BATCH * (0.5 + Math.random()));

        // Envoi d'un batch de clics
        for (let i = 0; i < randomClicks; i++) {
            ws.send(JSON.stringify({
                type: 'click',
                playerId: playerId,
                timestamp: Date.now()
            }));
            totalSent++;
        }

        batchCount++;

        // Afficher les stats tous les 10 batches
        if (batchCount % 10 === 0) {
            printStats();
        }

    }, ACTUAL_INTERVAL);

    // Durée maximale
    if (MAX_DURATION > 0) {
        setTimeout(() => {
            log('⏱️', `Durée max (${MAX_DURATION}s) atteinte`);
            stopClicking();
            printStats();
            ws.close();
        }, MAX_DURATION * 1000);
    }
}

function stopClicking() {
    if (clickInterval) {
        clearInterval(clickInterval);
        clickInterval = null;
    }
}

// Arrêt propre avec Ctrl+C
process.on('SIGINT', () => {
    log('🛑', `Arrêt demandé`);
    stopClicking();
    if (startTime) printStats();
    ws.close();
    process.exit(0);
});

// =============================================
// INFO DE DÉMARRAGE
// =============================================
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║       🤖 ClickWars Stress Bot - Indépendant      ║');
console.log('╠══════════════════════════════════════════════════╣');
console.log(`║  Bot      : ${BOT_NAME.padEnd(36)}║`);
console.log(`║  Serveur  : ${URL.padEnd(36)}║`);
console.log(`║  Équipe   : ${(TEAM || 'Auto-balance').padEnd(36)}║`);
console.log(`║  Débit    : ${(CLICKS_PER_BATCH + ' clics / ' + BATCH_INTERVAL_MS + 'ms').padEnd(36)}║`);
console.log(`║  Durée    : ${(MAX_DURATION > 0 ? MAX_DURATION + 's' : 'Infini (Ctrl+C)').padEnd(36)}║`);
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
