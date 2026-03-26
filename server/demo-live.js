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

// --- Mode production (WSS) ou local (WS) ---
// Usage prod :  SERVER_URL=wss://clickwars-ws.3sigma-studios.com node demo-live.js
// Usage local : node demo-live.js   (par defaut localhost:7777 et 7778)
const SERVER_URL = process.env.SERVER_URL || null;
const PORT1 = parseInt(process.env.PORT1 || '7777');
const PORT2 = parseInt(process.env.PORT2 || '7778');
const BOTS_PAR_EQUIPE = parseInt(process.env.BOTS || '5');
const MAX_GAUGE = parseInt(process.env.MAX_GAUGE || '2000'); // ~90 secondes avec 10 bots
const DELAY_MIN = parseInt(process.env.DELAY_MIN || '80');   // ms entre chaque clic
const DELAY_MAX = parseInt(process.env.DELAY_MAX || '300');

const C = require('./cli-colors');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

console.log(`${C.bold}${C.cyan}`);
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🎮  DEMO LIVE — ClickWars Multi-Instances                  ║');
console.log('║  Simulation continue sur 2 serveurs independants            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(C.reset);
if (SERVER_URL) {
    console.log(`  ${C.green}MODE PRODUCTION${C.reset} → ${C.yellow}${SERVER_URL}${C.reset}`);
    console.log(`  Dashboard : ${C.cyan}https://clickwars.3sigma-studios.com${C.reset}`);
} else {
    console.log(`  ${C.yellow}MODE LOCAL${C.reset}`);
    console.log(`  Instance 1 → port ${C.yellow}${PORT1}${C.reset}   (dashboard ${C.cyan}localhost:3000${C.reset})`);
    console.log(`  Instance 2 → port ${C.yellow}${PORT2}${C.reset}   (dashboard ${C.cyan}localhost:3001${C.reset})`);
}
console.log(`  Bots par equipe : ${BOTS_PAR_EQUIPE}`);
console.log(`  Objectif jauge  : ${MAX_GAUGE.toLocaleString()} clics`);
console.log(`  Arret : Ctrl+C\n`);

// ─── Connexion WebSocket ───────────────────────────────────────────
function connect(url, label) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.label = label;
        ws.on('open', () => resolve(ws));
        ws.on('error', (e) => reject(new Error(`${label} (${url}) inaccessible : ${e.message}`)));
        setTimeout(() => reject(new Error(`${label} timeout`)), 10000);
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

let globalWs1 = null;

async function run() {
    // ─── 1. Connexion au(x) serveur(s) ───
    let ws1, ws2;
    try {
        if (SERVER_URL) {
            // Production : 2 connexions au meme serveur (le load balancer distribue)
            process.stdout.write(`  Connexion a ${SERVER_URL}... `);
            [ws1, ws2] = await Promise.all([
                connect(SERVER_URL, 'Conn 1'),
                connect(SERVER_URL, 'Conn 2'),
            ]);
        } else {
            // Local : 2 ports differents
            process.stdout.write('  Connexion aux 2 instances locales... ');
            [ws1, ws2] = await Promise.all([
                connect(`ws://localhost:${PORT1}`, 'Instance 1'),
                connect(`ws://localhost:${PORT2}`, 'Instance 2'),
            ]);
        }
        globalWs1 = ws1;
        console.log(`${C.green}OK${C.reset}`);
    } catch (e) {
        console.log(`\n${C.red}ERREUR ${e.message}${C.reset}\n`);
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
    if (SERVER_URL) {
        console.log(`\n  ${C.cyan}Ouvre le dashboard :${C.reset}`);
        console.log(`    ${C.yellow}https://clickwars.3sigma-studios.com${C.reset}`);
    } else {
        console.log(`\n  ${C.cyan}Ouvre les dashboards :${C.reset}`);
        console.log(`    ${C.yellow}http://localhost:3000${C.reset}  ← Instance 1`);
        console.log(`    ${C.yellow}http://localhost:3001${C.reset}  ← Instance 2`);
    }
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
                console.log(`\n\n${C.bold}${C.green}  VICTOIRE EQUIPE ${msg.winner} !${C.reset}`);
                console.log(`  Les clics continuent mais sont maintenant REJETES.`);
                console.log(`  Pour relancer : ${C.yellow}node reset.js${C.reset} puis ${C.yellow}node demo-live.js${C.reset}\n`);
            }
        } catch(e) {}
    });

    setInterval(() => {
        const barA = '='.repeat(Math.round(Math.min(lastGaugeA / MAX_GAUGE, 1) * 20));
        const barB = '='.repeat(Math.round(Math.min(lastGaugeB / MAX_GAUGE, 1) * 20));
        process.stdout.write(
            `\r  ${C.blue}A [${barA.padEnd(20, '-')}] ${String(lastGaugeA).padStart(6)}${C.reset}` +
            `   ${C.red}B [${barB.padEnd(20, '-')}] ${String(lastGaugeB).padStart(6)}${C.reset}  `
        );
    }, 500);

    // ─── 9. Simulate connection lifecycle events ───
    // Periodically connect/disconnect/reconnect "ghost players" to generate lifecycle events
    console.log(`\n  ${C.magenta}Lifecycle simulation: random connect/disconnect/reconnect every 5-15s${C.reset}\n`);

    let ghostCounter = 0;
    const ghostNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank'];
    let lastGhostWs = null;
    let lastGhostName = null;
    let lastGhostPort = null;

    async function simulateLifecycle() {
        const port = Math.random() > 0.5 ? PORT1 : PORT2;
        const dashPort = port === PORT1 ? 3000 : 3001;

        try {
            // Reconnect scenario: if we have a recently disconnected ghost, reconnect it
            if (lastGhostName && Math.random() > 0.5) {
                const name = lastGhostName;
                const rPort = lastGhostPort || port;
                const ghostUrl = SERVER_URL || `ws://localhost:${rPort}`;
                console.log(`  ${C.yellow}[lifecycle] Reconnecting ${name}...${C.reset}`);
                const ws = new WebSocket(ghostUrl);
                ws.on('open', () => {
                    ws.send(JSON.stringify({ type: 'player_join', playerId: `ghost_${++ghostCounter}`, name: name }));
                    lastGhostWs = ws;
                    lastGhostName = name;
                    lastGhostPort = rPort;
                    // Will disconnect later
                    const stayTime = rand(3000, 8000);
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            console.log(`  ${C.red}[lifecycle] ${name} leaving (normal close) after ${Math.round(stayTime/1000)}s${C.reset}`);
                            ws.close(1000);
                            lastGhostName = name;
                            lastGhostPort = rPort;
                        }
                    }, stayTime);
                });
                ws.on('error', () => {});
            } else {
                // New player scenario
                const name = ghostNames[ghostCounter % ghostNames.length];
                ghostCounter++;
                const ghostUrl = SERVER_URL || `ws://localhost:${port}`;
                console.log(`  ${C.green}[lifecycle] New player ${name} connecting...${C.reset}`);
                const ws = new WebSocket(ghostUrl);
                ws.on('open', () => {
                    ws.send(JSON.stringify({ type: 'player_join', playerId: `ghost_${ghostCounter}`, name: name }));
                    lastGhostWs = ws;
                    lastGhostName = name;
                    lastGhostPort = port;
                    // Random disconnect after some time
                    const stayTime = rand(4000, 12000);
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            // Sometimes simulate a hard drop (no close frame)
                            if (Math.random() > 0.7) {
                                console.log(`  ${C.red}[lifecycle] ${name} dropped (connection lost)${C.reset}`);
                                ws.terminate(); // Hard kill — generates code 1006
                            } else {
                                console.log(`  ${C.red}[lifecycle] ${name} leaving (normal close) after ${Math.round(stayTime/1000)}s${C.reset}`);
                                ws.close(1000);
                            }
                            lastGhostName = name;
                            lastGhostPort = port;
                        }
                    }, stayTime);
                });
                ws.on('error', () => {});
            }
        } catch (e) {}

        // Schedule next lifecycle event
        const nextDelay = rand(5000, 15000);
        setTimeout(simulateLifecycle, nextDelay);
    }

    // Start lifecycle sim after a 3s delay
    setTimeout(simulateLifecycle, 3000);
}

run();

process.on('SIGINT', () => {
    console.log(`\n\n  ${C.yellow}Demo arretee.${C.reset}\n`);
    process.exit(0);
});

// ─── Touche R = reset a distance ─────────────────────────────────
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
        if (key.toString() === 'r' || key.toString() === 'R') {
            console.log(`\n  ${C.yellow}[remote] Reset + nouvelle partie...${C.reset}`);
            if (globalWs1 && globalWs1.readyState === WebSocket.OPEN) {
                globalWs1.send(JSON.stringify({ type: 'reset_game' }));
                setTimeout(() => {
                    globalWs1.send(JSON.stringify({ type: 'start_game' }));
                    console.log(`  ${C.green}[remote] Nouvelle partie lancee.${C.reset}`);
                }, 1000);
            }
        }
        if (key.toString() === '\u0003') process.exit(0); // Ctrl+C
    });
    console.log(`  ${C.cyan}Tip: appuie sur ${C.bold}R${C.reset}${C.cyan} pour reset la partie a distance${C.reset}\n`);
}
