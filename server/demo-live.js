#!/usr/bin/env node
/**
 * demo-live.js
 *
 * Script de demo pour la visio avec le patron.
 * Lance une simulation continue sur les 2 instances.
 *
 * PRE-REQUIS :
 *   - Instance 1 sur port 7777  (REDIS_URL=... GAME_PORT=7777 node websocket-server.js)
 *   - Instance 2 sur port 7778  (REDIS_URL=... GAME_PORT=7778 node websocket-server.js)
 *
 * Usage: node demo-live.js
 * Arret : Ctrl+C
 */

const WebSocket = require('ws');

const PORT1 = parseInt(process.env.PORT1 || '7777');
const PORT2 = parseInt(process.env.PORT2 || '7778');
const BOTS_PAR_EQUIPE = parseInt(process.env.BOTS || '5');
const MAX_GAUGE = parseInt(process.env.MAX_GAUGE || '999999'); // Tres grand pour que ca dure longtemps
const DELAY_MIN = parseInt(process.env.DELAY_MIN || '80');   // ms entre chaque clic
const DELAY_MAX = parseInt(process.env.DELAY_MAX || '300');

const C = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

console.log(`${C.bold}${C.cyan}`);
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🎮  DEMO LIVE — ClickWars Multi-Instances                  ║');
console.log('║  Simulation continue sur 2 serveurs independants            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(C.reset);
console.log(`  Instance 1 → port ${C.yellow}${PORT1}${C.reset}   (ouvre dashboard sur ${C.cyan}localhost:3000${C.reset})`);
console.log(`  Instance 2 → port ${C.yellow}${PORT2}${C.reset}   (ouvre dashboard sur ${C.cyan}localhost:3001${C.reset})`);
console.log(`  Bots par equipe : ${BOTS_PAR_EQUIPE}`);
console.log(`  Objectif jauge  : ${MAX_GAUGE.toLocaleString()} clics (tres grand = la demo dure longtemps)`);
console.log(`  Arret : Ctrl+C\n`);

// ─── Connexion WebSocket ───────────────────────────────────────────
function connect(port, label) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}`);
        ws.label = label;
        ws.on('open', () => resolve(ws));
        ws.on('error', (e) => reject(new Error(`${label} (port ${port}) inaccessible : ${e.message}\n  → Lance le serveur avec : REDIS_URL=redis://127.0.0.1:6379 GAME_PORT=${port} DASHBOARD_PORT=${port === PORT1 ? 3000 : 3001} node websocket-server.js`)));
        setTimeout(() => reject(new Error(`${label} timeout`)), 5000);
    });
}

// ─── Envoyer un message et attendre la reponse ────────────────────
function waitForState(ws) {
    return new Promise((resolve) => {
        const handler = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'state_update' || msg.type === 'lobby_update') {
                    ws.removeListener('message', handler);
                    resolve(msg);
                }
            } catch (e) {}
        };
        ws.on('message', handler);
    });
}

// ─── Loop de clics pour un bot ────────────────────────────────────
function startBotClicker(ws, bot, color, label) {
    let count = 0;
    async function click() {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(JSON.stringify({ type: 'click', playerId: bot.id, timestamp: Date.now() }));
            count++;
            if (count % 50 === 0) {
                process.stdout.write(`${color}  [${label}] ${bot.name} : ${count} clics${C.reset}\r`);
            }
        } catch (e) {}
        setTimeout(click, rand(DELAY_MIN, DELAY_MAX));
    }
    setTimeout(click, rand(0, 300)); // decalage initial aleatoire
}

async function run() {
    // ─── 1. Connexion aux 2 instances ───
    let ws1, ws2;
    try {
        process.stdout.write('  Connexion aux 2 instances... ');
        [ws1, ws2] = await Promise.all([
            connect(PORT1, 'Instance 1'),
            connect(PORT2, 'Instance 2'),
        ]);
        console.log(`${C.green}✅${C.reset}`);
    } catch (e) {
        console.log(`\n${C.red}❌ ${e.message}${C.reset}\n`);
        process.exit(1);
    }

    // ─── 2. Configurer le maxGauge (grand = la demo dure longtemps) ───
    ws1.send(JSON.stringify({ type: 'update_config', maxGauge: MAX_GAUGE }));
    await sleep(200);

    // ─── 3. Ajouter des bots sur INSTANCE 1 (equipe A) ───
    console.log(`  Ajout de ${BOTS_PAR_EQUIPE} bots equipe A sur Instance 1...`);
    for (let i = 1; i <= BOTS_PAR_EQUIPE; i++) {
        ws1.send(JSON.stringify({ type: 'add_bot', name: `Bot-A${i}`, team: 'A' }));
        await sleep(50);
    }

    // ─── 4. Ajouter des bots sur INSTANCE 2 (equipe B) ───
    console.log(`  Ajout de ${BOTS_PAR_EQUIPE} bots equipe B sur Instance 2...`);
    for (let i = 1; i <= BOTS_PAR_EQUIPE; i++) {
        ws2.send(JSON.stringify({ type: 'add_bot', name: `Bot-B${i}`, team: 'B' }));
        await sleep(50);
    }

    await sleep(300);

    // ─── 5. Demarrer le jeu depuis Instance 1 ───
    console.log(`  Demarrage du jeu depuis Instance 1...`);
    ws1.send(JSON.stringify({ type: 'start_game' }));
    await sleep(300);

    // ─── 6. Recuperer les bots de chaque equipe ───
    const statePromise1 = waitForState(ws1);
    ws1.send(JSON.stringify({ type: 'ping', ts: Date.now() })); // Trigger un state_update

    // Petit hack : envoyer un message pour recevoir le state
    const stateMsg = await Promise.race([
        statePromise1,
        sleep(1000).then(() => ({ players: [] }))
    ]);

    const allPlayers = stateMsg.players || [];
    const botsA = allPlayers.filter(p => p.isBot && p.team === 'A');
    const botsB = allPlayers.filter(p => p.isBot && p.team === 'B');

    if (botsA.length === 0 || botsB.length === 0) {
        // Fallback : recuperer via un click pour triggerer le state
        await sleep(500);
        const state2 = await Promise.race([
            waitForState(ws1),
            sleep(1000).then(() => null)
        ]);
        if (state2 && state2.players) {
            botsA.push(...state2.players.filter(p => p.isBot && p.team === 'A' && !botsA.find(b => b.id === p.id)));
            botsB.push(...state2.players.filter(p => p.isBot && p.team === 'B' && !botsB.find(b => b.id === p.id)));
        }
    }

    console.log(`\n${C.bold}${C.green}  ✅ Demo lancee !${C.reset}`);
    console.log(`  ${C.blue}Bots A${C.reset} (Instance 1) : ${botsA.map(b => b.name).join(', ') || 'simulation directe'}`);
    console.log(`  ${C.red}Bots B${C.reset} (Instance 2) : ${botsB.map(b => b.name).join(', ') || 'simulation directe'}`);
    console.log(`\n  ${C.cyan}Ouvre les dashboards dans le navigateur :${C.reset}`);
    console.log(`    ${C.yellow}http://localhost:3000${C.reset}  ← Instance 1`);
    console.log(`    ${C.yellow}http://localhost:3001${C.reset}  ← Instance 2`);
    console.log(`\n  Les deux dashboards doivent afficher le MEME etat en temps reel.`);
    console.log(`  Arret : ${C.bold}Ctrl+C${C.reset}\n`);

    // ─── 7. Lancer les clics continus ───
    const colors = [C.blue, C.cyan, C.magenta, C.green, C.yellow];

    // Si on a recupere les bots, les utiliser. Sinon creer des IDs fictifs.
    const effectiveBotsA = botsA.length > 0 ? botsA :
        Array.from({length: BOTS_PAR_EQUIPE}, (_, i) => ({ id: `bot_inst-AAAA1_${i+1}_demo`, name: `Bot-A${i+1}` }));
    const effectiveBotsB = botsB.length > 0 ? botsB :
        Array.from({length: BOTS_PAR_EQUIPE}, (_, i) => ({ id: `bot_inst-BBBB2_${i+1}_demo`, name: `Bot-B${i+1}` }));

    effectiveBotsA.forEach((bot, i) => startBotClicker(ws1, bot, colors[i % colors.length], 'Inst1'));
    effectiveBotsB.forEach((bot, i) => startBotClicker(ws2, bot, colors[(i + 2) % colors.length], 'Inst2'));

    // ─── 8. Affichage live du score toutes les 2s ───
    let lastGaugeA = 0, lastGaugeB = 0;

    ws1.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'state_update') {
                lastGaugeA = msg.teamAGauge || 0;
                lastGaugeB = msg.teamBGauge || 0;
            }
            if (msg.type === 'victory') {
                console.log(`\n\n${C.bold}${C.green}  🏆 VICTOIRE EQUIPE ${msg.winner} !${C.reset}`);
                console.log(`  Les 2 instances ont detecte le meme gagnant.`);
                console.log(`  Reset en cours...\n`);
                setTimeout(() => {
                    ws1.send(JSON.stringify({ type: 'reset_game' }));
                    setTimeout(() => {
                        ws1.send(JSON.stringify({ type: 'start_game' }));
                        console.log(`  ▶️  Nouvelle partie lancee automatiquement.\n`);
                    }, 1000);
                }, 2000);
            }
        } catch(e) {}
    });

    setInterval(() => {
        const barA = '█'.repeat(Math.round(Math.min(lastGaugeA / MAX_GAUGE, 1) * 20));
        const barB = '█'.repeat(Math.round(Math.min(lastGaugeB / MAX_GAUGE, 1) * 20));
        process.stdout.write(
            `\r  ${C.blue}A [${barA.padEnd(20, '░')}] ${String(lastGaugeA).padStart(6)}${C.reset}` +
            `   ${C.red}B [${barB.padEnd(20, '░')}] ${String(lastGaugeB).padStart(6)}${C.reset}  `
        );
    }, 500);
}

run();

process.on('SIGINT', () => {
    console.log(`\n\n  ${C.yellow}Demo arretee.${C.reset}\n`);
    process.exit(0);
});
