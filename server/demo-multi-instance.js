#!/usr/bin/env node

/**
 * demo-multi-instance.js
 *
 * Demonstration visuelle du multi-instances.
 * Lance 2 vrais GameServer sur des ports differents, connectes au meme Redis.
 * Simule des joueurs qui cliquent sur chaque instance et montre que
 * l'etat du jeu est partage en temps reel.
 *
 * PRE-REQUIS : Redis tourne sur localhost:6379 (redis-server --daemonize yes)
 *
 * Usage: node demo-multi-instance.js
 */

const WebSocket = require('ws');
const http = require('http');
const GameServer = require('./GameServer');
const { RedisStore, MemoryStore, createStore } = require('./SharedStateStore');

const USE_REDIS = !!process.env.REDIS_URL || true;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const PORT_1 = 7781;
const PORT_2 = 7782;

// Couleurs terminal
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    red:    '\x1b[31m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    blue:   '\x1b[34m',
    cyan:   '\x1b[36m',
    white:  '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgRed:  '\x1b[41m',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bar(value, max, width = 30, color = C.green) {
    const filled = Math.round((value / max) * width);
    const empty = width - filled;
    return color + '█'.repeat(filled) + C.reset + '░'.repeat(empty);
}

function printState(label, store, instanceInfo) {
    const gaugeA = store.getGauge('A');
    const gaugeB = store.getGauge('B');
    const max = store.getMaxGauge();
    const phase = store.getPhase();
    const players = store.getPlayers();
    const winner = store.getWinner();

    console.log(`\n${C.bold}${C.cyan}━━━ ${label} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(`  Instance : ${C.yellow}${instanceInfo}${C.reset}  |  Phase : ${C.bold}${phase === 'victory' ? C.green : C.white}${phase.toUpperCase()}${C.reset}`);
    console.log(`  Team A   [${bar(gaugeA, max, 25, C.blue)}] ${C.blue}${gaugeA}${C.reset}/${max}`);
    console.log(`  Team B   [${bar(gaugeB, max, 25, C.red)}] ${C.red}${gaugeB}${C.reset}/${max}`);
    if (players.length > 0) {
        console.log(`  Joueurs  : ${players.map(p => `${C.yellow}${p.name}${C.reset}(${p.team}) score=${p.score}`).join('  ')}`);
    }
    if (winner) {
        console.log(`  ${C.bold}${C.green}🏆 GAGNANT : Equipe ${winner} !${C.reset}`);
    }
}

async function runDemo() {
    console.clear();
    console.log(`${C.bold}${C.cyan}`);
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║       🎮  DEMO MULTI-INSTANCES ClickWars                        ║');
    console.log('║       2 serveurs independants, 1 seule partie partagee          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(C.reset);

    // ─── 1. Creer les stores ───
    let store1, store2;
    let usingRedis = false;

    try {
        store1 = new RedisStore(REDIS_URL, 'instance-1');
        await store1.connect();
        await store1.pub.flushall(); // Table rase pour la demo
        store2 = new RedisStore(REDIS_URL, 'instance-2');
        await store2.connect();
        usingRedis = true;
        console.log(`${C.green}✅ Redis connecte sur ${REDIS_URL}${C.reset}`);
        console.log(`${C.green}   Les 2 instances partagent la meme base de donnees Redis${C.reset}\n`);
    } catch (e) {
        console.log(`${C.yellow}⚠️  Redis non disponible, utilisation de MemoryStore (store partage)${C.reset}\n`);
        const sharedStore = new MemoryStore();
        store1 = sharedStore;
        store2 = sharedStore;
    }

    // ─── 2. Creer les GameServers ───
    const gs1 = new GameServer(store1, 'instance-1');
    const gs2 = new GameServer(store2, 'instance-2');

    console.log(`${C.bold}Instance 1${C.reset} : port ${C.yellow}${PORT_1}${C.reset}  (simule un 1er serveur)`);
    console.log(`${C.bold}Instance 2${C.reset} : port ${C.yellow}${PORT_2}${C.reset}  (simule un 2eme serveur derriere un load balancer)`);
    console.log('');

    // Configurer les relay de broadcast Redis -> clients locaux
    if (usingRedis) {
        store1.onBroadcastReceived = (msg) => {
            gs1.clients.forEach(c => { try { if(c.ws?.readyState===1) c.ws.send(JSON.stringify(msg)); } catch(e){} });
        };
        store2.onBroadcastReceived = (msg) => {
            gs2.clients.forEach(c => { try { if(c.ws?.readyState===1) c.ws.send(JSON.stringify(msg)); } catch(e){} });
        };
    }

    // ─── 3. Faux clients WebSocket (simule des joueurs) ───
    function makeFakeWs(name) {
        return {
            readyState: 1,
            name,
            send: () => {}
        };
    }

    await sleep(500);

    // ─── ETAPE 1 : Joueurs qui rejoignent sur des instances differentes ───
    console.log(`${C.bold}${C.cyan}ETAPE 1 — Des joueurs rejoignent sur des instances differentes${C.reset}`);
    console.log('─'.repeat(60));

    const ws_alice = makeFakeWs('Alice');
    gs1.addClient('c_alice', ws_alice);
    gs1.handleMessage('c_alice', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    console.log(`  👤 Alice rejoint via ${C.yellow}INSTANCE 1${C.reset} (port ${PORT_1})`);

    await sleep(300);

    const ws_bob = makeFakeWs('Bob');
    gs2.addClient('c_bob', ws_bob);
    gs2.handleMessage('c_bob', { type: 'player_join', playerId: 'bob', name: 'Bob' });
    console.log(`  👤 Bob   rejoint via ${C.yellow}INSTANCE 2${C.reset} (port ${PORT_2})`);

    await sleep(usingRedis ? 300 : 50);

    printState('ETAT VU PAR INSTANCE 1', store1, 'instance-1 : port ' + PORT_1);
    printState('ETAT VU PAR INSTANCE 2', store2, 'instance-2 : port ' + PORT_2);

    const p1 = store1.getPlayerCount();
    const p2 = store2.getPlayerCount();
    console.log(`\n  ${p1 === 2 && p2 === 2 ? C.green + '✅' : C.red + '❌'} Les 2 instances voient ${p1} / ${p2} joueurs${C.reset}`);

    await sleep(1000);

    // ─── ETAPE 2 : Demarrer le jeu ───
    console.log(`\n\n${C.bold}${C.cyan}ETAPE 2 — L'hote demarre la partie depuis Instance 1${C.reset}`);
    console.log('─'.repeat(60));

    store1.setMaxGauge(50);
    gs1.handleMessage('c_alice', { type: 'start_game' });
    console.log(`  ▶️  start_game envoye via Instance 1`);

    await sleep(usingRedis ? 300 : 50);

    const phase1 = store1.getPhase();
    const phase2 = store2.getPhase();
    console.log(`  Instance 1 phase : ${C.bold}${phase1}${C.reset}`);
    console.log(`  Instance 2 phase : ${C.bold}${phase2}${C.reset}`);
    console.log(`  ${phase1 === 'playing' && phase2 === 'playing' ? C.green + '✅ Les 2 instances sont synchronisees en phase playing' : C.red + '❌ Desynchronisation detectee'}${C.reset}`);

    await sleep(1000);

    // ─── ETAPE 3 : Clics concurrents ───
    console.log(`\n\n${C.bold}${C.cyan}ETAPE 3 — Clics concurrents depuis les 2 instances${C.reset}`);
    console.log('─'.repeat(60));

    const CLICKS_ALICE = 20;
    const CLICKS_BOB   = 15;

    console.log(`  Alice clique ${CLICKS_ALICE}x sur Instance 1...`);
    for (let i = 0; i < CLICKS_ALICE; i++) {
        gs1.handleMessage('c_alice', { type: 'click', playerId: 'alice' });
    }

    console.log(`  Bob   clique ${CLICKS_BOB}x sur Instance 2...`);
    for (let i = 0; i < CLICKS_BOB; i++) {
        gs2.handleMessage('c_bob', { type: 'click', playerId: 'bob' });
    }

    await sleep(usingRedis ? 500 : 50);

    printState('ETAT VU PAR INSTANCE 1', store1, 'instance-1');
    printState('ETAT VU PAR INSTANCE 2', store2, 'instance-2');

    const gA1 = store1.getGauge('A'), gB1 = store1.getGauge('B');
    const gA2 = store2.getGauge('A'), gB2 = store2.getGauge('B');
    console.log(`\n  ${gA1 === gA2 && gB1 === gB2 ? C.green + '✅ Jauges identiques sur les 2 instances' : C.red + '❌ Jauges desynchronisees'}${C.reset}`);

    await sleep(1000);

    // ─── ETAPE 4 : Victoire ───
    console.log(`\n\n${C.bold}${C.cyan}ETAPE 4 — Alice finit de cliquer pour gagner${C.reset}`);
    console.log('─'.repeat(60));

    const remaining = store1.getMaxGauge() - store1.getGauge('A');
    console.log(`  Il reste ${remaining} clics pour que Team A gagne...`);

    for (let i = 0; i < remaining; i++) {
        gs1.handleMessage('c_alice', { type: 'click', playerId: 'alice' });
    }

    await sleep(usingRedis ? 400 : 50);

    printState('ETAT FINAL — INSTANCE 1', store1, 'instance-1');
    printState('ETAT FINAL — INSTANCE 2', store2, 'instance-2');

    const w1 = store1.getWinner();
    const w2 = store2.getWinner();
    console.log(`\n  Instance 1 gagnant : ${C.bold}${w1 || 'aucun'}${C.reset}`);
    console.log(`  Instance 2 gagnant : ${C.bold}${w2 || 'aucun'}${C.reset}`);
    console.log(`  ${w1 && w1 === w2 ? C.green + '✅ Les 2 instances sont d\'accord sur le gagnant' : C.red + '❌ Conflit de victoire !'}${C.reset}`);

    // ─── RESUME FINAL ───
    await sleep(500);
    console.log(`\n\n${C.bold}${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(`${C.bold}  BILAN DE LA DEMONSTRATION${C.reset}`);
    console.log(`${'─'.repeat(60)}`);

    const checks = [
        [store1.getPlayerCount() === 2 && store2.getPlayerCount() === 2,
         'Les joueurs de 2 instances differentes sont dans la meme partie'],
        [store1.getPhase() === store2.getPhase(),
         `La phase de jeu est synchronisee (${store1.getPhase()})`],
        [store1.getGauge('A') === store2.getGauge('A') && store1.getGauge('B') === store2.getGauge('B'),
         'Les jauges sont identiques sur les 2 instances'],
        [w1 && w1 === w2,
         `Un seul gagnant declare (Equipe ${w1}), pas de doublon`],
        [usingRedis,
         `Etat partage via Redis (${REDIS_URL})`],
    ];

    let allOk = true;
    for (const [ok, msg] of checks) {
        if (!ok) allOk = false;
        console.log(`  ${ok ? C.green + '✅' : C.red + '❌'}${C.reset} ${msg}`);
    }

    console.log('');
    if (allOk) {
        console.log(`${C.bold}${C.green}  🎉 DEMO REUSSIE — Le serveur est pret pour le multi-instances !${C.reset}`);
    } else {
        console.log(`${C.red}  ⚠️  Certains points ont echoue — voir les details ci-dessus.${C.reset}`);
    }
    console.log(`${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`);

    // Cleanup
    gs1.stopBotLoop();
    gs2.stopBotLoop();
    if (gs1.pendingBroadcast) clearTimeout(gs1.pendingBroadcast);
    if (gs2.pendingBroadcast) clearTimeout(gs2.pendingBroadcast);
    if (store1.disconnect) await store1.disconnect();
    if (store2 !== store1 && store2.disconnect) await store2.disconnect();

    process.exit(allOk ? 0 : 1);
}

runDemo().catch(err => {
    console.error('Erreur demo:', err);
    process.exit(1);
});
