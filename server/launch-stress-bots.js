#!/usr/bin/env node

/**
 * launch-stress-bots.js - Lanceur de bots INDÉPENDANTS
 *
 * Chaque bot est un PROCESS SÉPARÉ exécutant stress-bot.js.
 * Respecte l'architecture demandée : isolation totale des processus.
 *
 * Usage:
 *   node launch-stress-bots.js
 *   node launch-stress-bots.js --botsA 50 --botsB 50 --rate 10000
 *   node launch-stress-bots.js --botsA 100 --botsB 100 --rate 500 --duration 60
 *   node launch-stress-bots.js --host 192.168.1.50 --port 7777
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

const BOTS_TEAM_A = parseInt(getArg('botsA', '50'));
const BOTS_TEAM_B = parseInt(getArg('botsB', '50'));
const CLICKS_PER_BATCH = parseInt(getArg('rate', '250')); // 250 clics/500ms = 1 clic toutes les 2ms !
const BATCH_INTERVAL = parseInt(getArg('interval', '500'));
const DURATION = parseInt(getArg('duration', '0')); // 0 = pas de limite (arrêt à la victoire)
const HOST = getArg('host', 'localhost');
const PORT = getArg('port', '7777');
const DELAY_BETWEEN_SPAWNS = parseInt(getArg('delay', '50')); // ms entre chaque spawn

const TOTAL_BOTS = BOTS_TEAM_A + BOTS_TEAM_B;
const STRESS_BOT_SCRIPT = path.join(__dirname, 'stress-bot.js');

// =============================================
// ÉTAT
// =============================================
const botProcesses = [];
let finishedCount = 0;
let errorCount = 0;
const botStats = [];
const startTime = Date.now();

// =============================================
// BANNIÈRE
// =============================================
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║     🚀 ClickWars - Lanceur de Bots Indépendants             ║');
console.log('║     Chaque bot = 1 processus Node.js séparé                 ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Serveur       : ws://${HOST}:${PORT}`.padEnd(63) + '║');
console.log(`║  Bots Équipe A : ${BOTS_TEAM_A} process`.padEnd(63) + '║');
console.log(`║  Bots Équipe B : ${BOTS_TEAM_B} process`.padEnd(63) + '║');
console.log(`║  Total process : ${TOTAL_BOTS}`.padEnd(63) + '║');
console.log(`║  Clics/batch   : ${CLICKS_PER_BATCH.toLocaleString()} par bot / ${BATCH_INTERVAL}ms`.padEnd(63) + '║');
console.log(`║  Durée         : ${DURATION > 0 ? DURATION + 's' : 'Infini (arrêt à la victoire)'}`.padEnd(63) + '║');
console.log(`║  Débit max     : ${(TOTAL_BOTS * CLICKS_PER_BATCH * (1000 / BATCH_INTERVAL)).toLocaleString()} clics/s`.padEnd(63) + '║');
console.log(`║  Délai spawn   : ${DELAY_BETWEEN_SPAWNS}ms entre chaque bot`.padEnd(63) + '║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

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
// SPAWN D'UN BOT
// =============================================
function spawnBot(index, team) {
    const botName = `Bot_${team}_${String(index).padStart(4, '0')}`;

    const botArgs = [
        STRESS_BOT_SCRIPT,
        '--team', team,
        '--name', botName,
        '--rate', String(CLICKS_PER_BATCH),
        '--interval', String(BATCH_INTERVAL),
        '--host', HOST,
        '--port', PORT,
        '--duration', String(DURATION)
    ];

    const child = spawn('node', botArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
    });

    const botInfo = {
        pid: child.pid,
        name: botName,
        team: team,
        process: child,
        output: '',
        exitCode: null
    };

    // Capturer la sortie (dernières lignes seulement pour économiser la mémoire)
    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        // Garder seulement les lignes importantes
        lines.forEach(line => {
            if (line.includes('🏆') || line.includes('📊') || line.includes('✅') ||
                line.includes('👻') || line.includes('❌') || line.includes('🎮')) {
                botInfo.output = line.trim(); // Dernier message important
            }
        });
    });

    child.stderr.on('data', (data) => {
        // Ignorer les erreurs mineures
    });

    child.on('exit', (code) => {
        botInfo.exitCode = code;
        finishedCount++;
        if (code !== 0) errorCount++;

        // Afficher un résumé quand tous les bots ont fini
        if (finishedCount === botProcesses.length) {
            showFinalReport();
        }
    });

    botProcesses.push(botInfo);
    return botInfo;
}

// =============================================
// LANCEMENT SÉQUENTIEL
// =============================================
async function launchAllBots() {
    log('🚀', `Lancement de ${TOTAL_BOTS} bots indépendants...`);
    log('💡', `Chaque bot est un process Node.js séparé (PID unique)`);
    console.log('');

    let spawned = 0;

    // Équipe A
    for (let i = 1; i <= BOTS_TEAM_A; i++) {
        spawnBot(i, 'A');
        spawned++;
        printProgress(spawned, TOTAL_BOTS, `Process lancés (A: ${Math.min(i, BOTS_TEAM_A)} | B: ${Math.max(0, spawned - BOTS_TEAM_A)})`);
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_SPAWNS));
    }

    // Équipe B
    for (let i = 1; i <= BOTS_TEAM_B; i++) {
        spawnBot(i, 'B');
        spawned++;
        printProgress(spawned, TOTAL_BOTS, `Process lancés (A: ${BOTS_TEAM_A} | B: ${i})`);
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_SPAWNS));
    }

    console.log(''); // Nouvelle ligne
    console.log('');

    // Lister les PIDs
    const pidsA = botProcesses.filter(b => b.team === 'A').map(b => b.pid);
    const pidsB = botProcesses.filter(b => b.team === 'B').map(b => b.pid);

    log('✅', `${botProcesses.length} process lancés !`);
    log('🔴', `Équipe A : ${pidsA.length} process (PIDs: ${pidsA.slice(0, 5).join(', ')}${pidsA.length > 5 ? '...' : ''})`);
    log('🔵', `Équipe B : ${pidsB.length} process (PIDs: ${pidsB.slice(0, 5).join(', ')}${pidsB.length > 5 ? '...' : ''})`);
    log('⏳', `Les bots attendent le démarrage de la partie...`);
    log('💡', `Lancez la partie depuis le lobby Qt pour démarrer le stress test`);
    log('⏱️', `Durée du test : ${DURATION}s - les bots s'arrêteront automatiquement`);
    console.log('');

    // Timer pour afficher le statut périodiquement
    const statusInterval = setInterval(() => {
        const alive = botProcesses.filter(b => b.exitCode === null).length;
        const finished = botProcesses.filter(b => b.exitCode !== null).length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

        if (alive === 0) {
            clearInterval(statusInterval);
            return;
        }

        log('📊', `[${elapsed}s] Process actifs: ${alive} | Terminés: ${finished} | Erreurs: ${errorCount}`);
    }, 10000); // Toutes les 10 secondes
}

// =============================================
// RAPPORT FINAL
// =============================================
function showFinalReport() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = botProcesses.filter(b => b.exitCode === 0).length;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              📊 RAPPORT FINAL - BOTS INDÉPENDANTS            ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Durée totale     : ${(elapsed + 's').padEnd(40)}║`);
    console.log(`║  Process lancés   : ${String(botProcesses.length).padEnd(40)}║`);
    console.log(`║  Réussis (exit 0) : ${String(successful).padEnd(40)}║`);
    console.log(`║  Erreurs          : ${String(errorCount).padEnd(40)}║`);
    console.log(`║  Équipe A         : ${String(BOTS_TEAM_A + ' process').padEnd(40)}║`);
    console.log(`║  Équipe B         : ${String(BOTS_TEAM_B + ' process').padEnd(40)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Architecture     : ${'1 process = 1 bot (isolation totale)'.padEnd(40)}║`);
    console.log(`║  Clics/bot/batch  : ${String(CLICKS_PER_BATCH.toLocaleString()).padEnd(40)}║`);
    console.log(`║  Débit théorique  : ${(TOTAL_BOTS * CLICKS_PER_BATCH * (1000 / BATCH_INTERVAL)).toLocaleString().padEnd(37) + '/s'}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Derniers messages importants des bots
    const importantOutputs = botProcesses
        .filter(b => b.output.length > 0)
        .slice(0, 10);

    if (importantOutputs.length > 0) {
        console.log('📝 Derniers messages des bots :');
        importantOutputs.forEach(b => {
            console.log(`  ${b.name}: ${b.output}`);
        });
        console.log('');
    }

    log('✅', 'Tous les bots ont terminé !');

    // Quitter proprement
    setTimeout(() => process.exit(0), 1000);
}

// =============================================
// ARRÊT PROPRE
// =============================================
process.on('SIGINT', () => {
    log('🛑', 'Arrêt demandé - Terminaison de tous les bots...');

    botProcesses.forEach(bot => {
        try {
            bot.process.kill('SIGTERM');
        } catch (e) { /* ignore */ }
    });

    setTimeout(() => {
        // Force kill si pas terminés
        botProcesses.forEach(bot => {
            try {
                if (bot.exitCode === null) {
                    bot.process.kill('SIGKILL');
                }
            } catch (e) { /* ignore */ }
        });
        showFinalReport();
    }, 3000);
});

// =============================================
// EXÉCUTION
// =============================================
launchAllBots();
