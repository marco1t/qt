#!/usr/bin/env node

/**
 * mass-stress-test.js - Test de charge massif (multi-process)
 *
 * Chaque bot tourne dans son PROPRE processus Node.js (via stress-bot.js)
 * pour une isolation totale : mémoire, event loop et connexion WebSocket séparées.
 *
 * Usage:
 *   node mass-stress-test.js
 *   node mass-stress-test.js --bots 200 --rate 500 --duration 30
 *   node mass-stress-test.js --botsA 100 --botsB 100 --rate 200
 *   node mass-stress-test.js --host 192.168.1.50 --port 8080
 */

const { spawn } = require('child_process');
const path = require('path');

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
const PORT = getArg('port', '7777');
const BOTS_TEAM_A = parseInt(getArg('botsA', getArg('bots', '50')));
const BOTS_TEAM_B = parseInt(getArg('botsB', getArg('bots', '50')));
const CLICKS_PER_BATCH = getArg('rate', '250');
const BATCH_INTERVAL_MS = getArg('interval', '500');
const MAX_DURATION = getArg('duration', '0');
const SPAWN_DELAY_MS = parseInt(getArg('delay', '50')); // Délai entre chaque spawn

const TOTAL_BOTS = BOTS_TEAM_A + BOTS_TEAM_B;
const STRESS_BOT_PATH = path.join(__dirname, 'stress-bot.js');

// =============================================
// ÉTAT
// =============================================
const children = [];    // Processus enfants actifs
let spawned = 0;
let exited = 0;
let startTime = Date.now();

// =============================================
// BANNIÈRE
// =============================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     💣 ClickWars Mass Stress Test (Multi-Process)        ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  Serveur      : ${(`ws://${HOST}:${PORT}`).padEnd(40)}║`);
console.log(`║  Bots Équipe A: ${String(BOTS_TEAM_A).padEnd(40)}║`);
console.log(`║  Bots Équipe B: ${String(BOTS_TEAM_B).padEnd(40)}║`);
console.log(`║  Total bots   : ${String(TOTAL_BOTS).padEnd(40)}║`);
console.log(`║  Clics/batch  : ${(CLICKS_PER_BATCH + ' par bot / ' + BATCH_INTERVAL_MS + 'ms').padEnd(40)}║`);
console.log(`║  Durée        : ${(MAX_DURATION === '0' ? 'Infini (Ctrl+C)' : MAX_DURATION + 's').padEnd(40)}║`);
console.log(`║  Mode         : ${'1 process par bot (isolé)'.padEnd(40)}║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// =============================================
// SPAWN DES BOTS
// =============================================
function spawnBot(index, team) {
    const botName = `Mass_${team}_${String(index).padStart(4, '0')}`;

    const botArgs = [
        STRESS_BOT_PATH,
        '--host', HOST,
        '--port', PORT,
        '--team', team,
        '--name', botName,
        '--rate', CLICKS_PER_BATCH,
        '--interval', BATCH_INTERVAL_MS,
    ];

    if (MAX_DURATION !== '0') {
        botArgs.push('--duration', MAX_DURATION);
    }

    const child = spawn('node', botArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    child.botName = botName;
    child.botTeam = team;

    // Capturer les lignes importantes (victoire, stats finales, latence)
    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
            // Afficher uniquement les lignes importantes
            if (line.includes('🏆') || line.includes('📡') || line.includes('⏱️') && line.includes('victoire')) {
                console.log(`  [${botName}] ${line.trim()}`);
            }
        }
    });

    child.stderr.on('data', (data) => {
        console.error(`  ❌ [${botName}] ${data.toString().trim()}`);
    });

    child.on('exit', (code) => {
        exited++;
        if (exited === spawned) {
            printFinalReport();
        }
    });

    children.push(child);
    spawned++;
}

function printProgress() {
    const pct = Math.round(spawned / TOTAL_BOTS * 100);
    const bar = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(50 - Math.floor(pct / 2));
    process.stdout.write(`\r  ${bar} ${pct}% (${spawned}/${TOTAL_BOTS}) Bots lancés`);
}

async function spawnAllBots() {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] 🚀 Lancement de ${TOTAL_BOTS} processus bot...`);

    // Équipe A
    for (let i = 1; i <= BOTS_TEAM_A; i++) {
        spawnBot(i, 'A');
        printProgress();
        if (SPAWN_DELAY_MS > 0) {
            await new Promise(r => setTimeout(r, SPAWN_DELAY_MS));
        }
    }

    // Équipe B
    for (let i = 1; i <= BOTS_TEAM_B; i++) {
        spawnBot(i, 'B');
        printProgress();
        if (SPAWN_DELAY_MS > 0) {
            await new Promise(r => setTimeout(r, SPAWN_DELAY_MS));
        }
    }

    console.log(''); // Nouvelle ligne après progress bar
    const ts2 = new Date().toLocaleTimeString();
    console.log(`[${ts2}] ✅ ${spawned} bots lancés (${BOTS_TEAM_A} A + ${BOTS_TEAM_B} B) — chacun dans son propre processus`);
    console.log(`[${ts2}] ⏳ Les bots attendent le démarrage de la partie...`);
    console.log(`[${ts2}] 💡 Lancez la partie depuis le lobby ou le dashboard`);
    console.log('');
}

// =============================================
// RAPPORT FINAL
// =============================================
function printFinalReport() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           📊 RÉSULTATS DU STRESS TEST                    ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Durée totale    : ${(elapsed + 's').padEnd(37)}║`);
    console.log(`║  Bots lancés     : ${String(spawned).padEnd(37)}║`);
    console.log(`║  Bots terminés   : ${String(exited).padEnd(37)}║`);
    console.log(`║  Équipe A        : ${(BOTS_TEAM_A + ' bots').padEnd(37)}║`);
    console.log(`║  Équipe B        : ${(BOTS_TEAM_B + ' bots').padEnd(37)}║`);
    console.log(`║  Mode            : ${'Multi-process (isolé)'.padEnd(37)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ✅ Stress test terminé. Consultez le dashboard pour les stats de latence.`);
    process.exit(0);
}

// =============================================
// ARRÊT PROPRE
// =============================================
function killAll() {
    const ts = new Date().toLocaleTimeString();
    console.log(`\n[${ts}] 🛑 Arrêt de ${children.length} processus bot...`);
    children.forEach(child => {
        try { child.kill('SIGINT'); } catch (e) { /* ignore */ }
    });
    // Force exit après 5s si les enfants ne se terminent pas
    setTimeout(() => {
        children.forEach(child => {
            try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
        });
        printFinalReport();
    }, 5000);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

// =============================================
// EXÉCUTION
// =============================================
spawnAllBots();
