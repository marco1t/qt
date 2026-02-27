#!/usr/bin/env node

/**
 * mass-stress-test.js - Test de charge massif
 *
 * Génère N bots par équipe, chacun envoyant des clics en masse.
 * Tous les bots partagent le même process pour être efficace.
 *
 * Usage:
 *   node mass-stress-test.js
 *   node mass-stress-test.js --botsA 500 --botsB 500 --rate 200 --duration 20
 *   node mass-stress-test.js --host 192.168.1.50
 */

const WebSocket = require('ws');

// =============================================
// ARGUMENTS
// =============================================
const args = process.argv.slice(2);

function getArg(name, defaultValue) {
    const idx = args.indexOf('--' + name);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    return defaultValue;
}

const HOST = getArg('host', 'localhost');
const PORT = parseInt(getArg('port', '7777'));
const BOTS_TEAM_A = parseInt(getArg('botsA', '100'));
const BOTS_TEAM_B = parseInt(getArg('botsB', '100'));
const CLICKS_PER_BATCH = parseInt(getArg('rate', '250'));
const BATCH_INTERVAL_MS = parseInt(getArg('interval', '500'));
const MAX_DURATION = parseInt(getArg('duration', '0')); // 0 = infini au lieu de 30s
const URL = `ws://${HOST}:${PORT}`;

const TOTAL_BOTS = BOTS_TEAM_A + BOTS_TEAM_B;

// =============================================
// ÉTAT GLOBAL
// =============================================
let bots = [];              // Liste de tous les bots { ws, id, team, ready }
let connectedCount = 0;
let readyCount = 0;
let isPlaying = false;
let startTime = null;
let clickInterval = null;
let victoryReceived = false;

// Stats
let totalClicksSent = 0;
let batchCount = 0;
let botsConnected = { A: 0, B: 0 };

// =============================================
// AFFICHAGE
// =============================================
function log(emoji, msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${emoji} ${msg}`);
}

function printProgress(current, total, label) {
    const pct = Math.round(current / total * 100);
    const bar = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(50 - Math.floor(pct / 2));
    process.stdout.write(`\r  ${bar} ${pct}% (${current}/${total}) ${label}`);
}

// =============================================
// BANNIÈRE
// =============================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║        💣 ClickWars Mass Stress Test                     ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  Serveur    : ${URL.padEnd(42)}║`);
console.log(`║  Bots A     : ${String(BOTS_TEAM_A).padEnd(42)}║`);
console.log(`║  Bots B     : ${String(BOTS_TEAM_B).padEnd(42)}║`);
console.log(`║  Total bots : ${String(TOTAL_BOTS).padEnd(42)}║`);
console.log(`║  Clics/batch: ${String(CLICKS_PER_BATCH + ' par bot / ' + BATCH_INTERVAL_MS + 'ms').padEnd(42)}║`);
console.log(`║  Durée      : ${String(MAX_DURATION + 's').padEnd(42)}║`);
console.log(`║  Débit max  : ${String((TOTAL_BOTS * CLICKS_PER_BATCH * (1000 / BATCH_INTERVAL_MS)).toLocaleString() + ' clics/s').padEnd(42)}║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// =============================================
// PHASE 1 : Connexion des bots
// =============================================
log('🔌', `Connexion de ${TOTAL_BOTS} bots au serveur...`);

function connectBot(index, team) {
    return new Promise((resolve) => {
        const ws = new WebSocket(URL);
        const botId = `massbot_${team}_${index}_${Date.now()}`;
        const botName = `Bot_${team}_${String(index).padStart(4, '0')}`;

        const bot = {
            ws, id: botId, name: botName, team, ready: false, clicksSent: 0,
            // Chaque bot a un rythme différent : ±40% de variation
            clickMultiplier: 0.6 + Math.random() * 0.8  // entre 0.6x et 1.4x
        };

        ws.on('open', () => {
            // Enregistrer comme joueur
            ws.send(JSON.stringify({
                type: 'player_join',
                playerId: botId,
                name: botName,
                team: team
            }));
            bot.ready = true;
            connectedCount++;
            botsConnected[team]++;

            // Afficher la progression
            printProgress(connectedCount, TOTAL_BOTS, `Bots connectés (A: ${botsConnected.A} | B: ${botsConnected.B})`);

            resolve(bot);
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.phase === 'playing' && !isPlaying) {
                    isPlaying = true;
                }
                // Détection victoire → arrêter après 2s (latence réaliste)
                if (msg.type === 'victory' && !victoryReceived) {
                    victoryReceived = true;
                    log('🏆', `Victoire détectée ! Arrêt dans 0.5s...`);
                    setTimeout(() => {
                        stopTest();
                    }, 500);
                }
            } catch (e) { /* ignore */ }
        });

        ws.on('error', () => {
            connectedCount++;
            printProgress(connectedCount, TOTAL_BOTS, `(erreurs possibles)`);
            resolve(null); // Bot raté, on continue
        });

        ws.on('close', () => {
            bot.ready = false;
        });
    });
}

async function connectAllBots() {
    const promises = [];

    // Connexion par groupes de 50 pour ne pas surcharger
    const BATCH_SIZE = 50;
    let created = 0;

    // Bots Équipe A
    for (let i = 1; i <= BOTS_TEAM_A; i++) {
        promises.push(connectBot(i, 'A'));
        created++;
        if (created % BATCH_SIZE === 0) {
            await new Promise(r => setTimeout(r, 100)); // Petite pause
        }
    }

    // Bots Équipe B
    for (let i = 1; i <= BOTS_TEAM_B; i++) {
        promises.push(connectBot(i, 'B'));
        created++;
        if (created % BATCH_SIZE === 0) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    const results = await Promise.all(promises);
    bots = results.filter(b => b !== null);

    console.log(''); // Nouvelle ligne après la barre de progression
    log('✅', `${bots.length}/${TOTAL_BOTS} bots connectés (A: ${botsConnected.A} | B: ${botsConnected.B})`);

    return bots.length > 0;
}

// =============================================
// PHASE 2 : Attente du démarrage
// =============================================
function waitForGameStart() {
    return new Promise((resolve) => {
        log('⏳', 'En attente du démarrage de la partie...');
        log('💡', 'Lancez la partie depuis le lobby ou envoyez "start_game"');

        const checkInterval = setInterval(() => {
            if (isPlaying) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 200);
    });
}

// =============================================
// PHASE 3 : Envoi massif de clics
// =============================================
function startMassClicking() {
    startTime = Date.now();
    log('💥', `DÉBUT DU STRESS TEST ! ${bots.length} bots × ${CLICKS_PER_BATCH} clics / ${BATCH_INTERVAL_MS}ms`);

    clickInterval = setInterval(() => {
        // On continue d'envoyer même après victoire !
        // Le serveur comptera les clics tardifs comme "rejetés" (latence)

        let batchSent = 0;

        bots.forEach(bot => {
            if (!bot.ready || bot.ws.readyState !== WebSocket.OPEN) return;

            // Chaque bot envoie un nombre aléatoire différent à chaque batch (entre 50% et 150% du rate)
            const randomMultiplier = 0.5 + Math.random();
            const botClicks = Math.floor(CLICKS_PER_BATCH * randomMultiplier);

            for (let i = 0; i < botClicks; i++) {
                bot.ws.send(JSON.stringify({
                    type: 'click',
                    playerId: bot.id,
                    timestamp: Date.now()
                }));
                bot.clicksSent++;
                totalClicksSent++;
                batchSent++;
            }
        });

        batchCount++;

        // Stats toutes les 2 secondes
        if (batchCount % Math.ceil(2000 / BATCH_INTERVAL_MS) === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = Math.round(totalClicksSent / parseFloat(elapsed));
            const activeBots = bots.filter(b => b.ready && b.ws.readyState === WebSocket.OPEN).length;
            log('📊', `${totalClicksSent.toLocaleString()} clics | ${rate.toLocaleString()}/s | ${activeBots} bots actifs | ${elapsed}s`);
        }

    }, BATCH_INTERVAL_MS);

    // Arrêt après la durée max (si définie)
    if (MAX_DURATION > 0) {
        setTimeout(() => {
            stopTest();
        }, MAX_DURATION * 1000);
    }
}

// =============================================
// PHASE 4 : Arrêt et résultats
// =============================================
function stopTest() {
    if (clickInterval) {
        clearInterval(clickInterval);
        clickInterval = null;
    }

    const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 0;
    const rate = elapsed > 0 ? Math.round(totalClicksSent / parseFloat(elapsed)) : 0;
    const activeBots = bots.filter(b => b.ready).length;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              📊 RÉSULTATS DU STRESS TEST                 ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Durée              : ${String(elapsed + 's').padEnd(34)}║`);
    console.log(`║  Bots connectés     : ${String(activeBots + '/' + TOTAL_BOTS).padEnd(34)}║`);
    console.log(`║  Équipe A           : ${String(botsConnected.A + ' bots').padEnd(34)}║`);
    console.log(`║  Équipe B           : ${String(botsConnected.B + ' bots').padEnd(34)}║`);
    console.log(`║  ─────────────────────────────────────────────────────  ║`);
    console.log(`║  Total clics envoyés: ${String(totalClicksSent.toLocaleString()).padEnd(34)}║`);
    console.log(`║  Batches envoyés    : ${String(batchCount.toLocaleString()).padEnd(34)}║`);
    console.log(`║  Débit moyen        : ${String(rate.toLocaleString() + ' clics/s').padEnd(34)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // Top 10 bots
    const sorted = bots.sort((a, b) => b.clicksSent - a.clicksSent).slice(0, 10);
    console.log('🏆 Top 10 bots (Performances) :');
    sorted.forEach((bot, i) => {
        // Calcul du nombre de clics réels générés par milliseconde
        // elapsed = durée totale en secondes
        // On cherche le nombre de clics par tranche de 2ms
        const totalMs = elapsed * 1000;
        const clicksPer2ms = elapsed > 0 ? ((bot.clicksSent / totalMs) * 2).toFixed(2) : 0;

        console.log(`  ${i + 1}. ${bot.name} (${bot.team}) → ${bot.clicksSent.toLocaleString()} clics totaux (${clicksPer2ms} clics env./2ms)`);
    });
    console.log('');

    // Déconnexion
    log('🔌', 'Déconnexion de tous les bots...');
    bots.forEach(bot => {
        try { bot.ws.close(); } catch (e) { /* ignore */ }
    });

    setTimeout(() => {
        log('✅', 'Stress test terminé !');
        process.exit(0);
    }, 2000);
}

// =============================================
// EXÉCUTION
// =============================================
async function main() {
    try {
        // Phase 1 : Connexion
        const success = await connectAllBots();
        if (!success) {
            log('❌', 'Aucun bot connecté. Vérifiez que le serveur tourne.');
            process.exit(1);
        }

        // Phase 2 : Attente
        await waitForGameStart();

        // Phase 3 : Stress !
        startMassClicking();

    } catch (error) {
        log('❌', `Erreur: ${error.message}`);
        process.exit(1);
    }
}

// Arrêt propre
process.on('SIGINT', () => {
    log('🛑', 'Arrêt demandé par l\'utilisateur');
    stopTest();
});

main();
