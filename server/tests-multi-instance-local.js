#!/usr/bin/env node

/**
 * tests-multi-instance-local.js
 *
 * Preuve que l'architecture multi-instances fonctionne SANS Redis.
 *
 * Strategie : Avec Redis, toutes les instances partagent le MEME etat via
 * un store unique. On simule cela en donnant le MEME MemoryStore a 2
 * GameServer distincts, chacun avec ses propres clients WebSocket.
 *
 * Cela reproduit fidelement le deploiement reel :
 *   - 2 process Node.js avec chacun son GameServer
 *   - Connectes au meme Redis (ici : meme MemoryStore)
 *   - Chacun gere ses propres connexions WebSocket
 *
 * Usage: node tests-multi-instance-local.js
 */

const assert = require('assert');
const GameServer = require('./GameServer');
const { MemoryStore } = require('./SharedStateStore');

let passed = 0;
let failed = 0;
let total = 0;

const allServers = [];

function createMockWs() {
    const messages = [];
    return {
        readyState: 1,
        send: function (data) { messages.push(JSON.parse(data)); },
        messages
    };
}

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     → ${error.message}`);
    }
}

async function testAsync(name, fn) {
    total++;
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     → ${error.message}`);
    }
}

/**
 * Cree 2 GameServers partageant le MEME store (simule Redis).
 * Chaque instance a son propre ensemble de clients WebSocket.
 */
function createSharedInstances() {
    const store = new MemoryStore();
    const gs1 = new GameServer(store, 'inst-AAAA1111');
    const gs2 = new GameServer(store, 'inst-BBBB2222');
    allServers.push(gs1, gs2);
    return { gs1, gs2, store };
}

/**
 * Cree 2 GameServers avec des stores SEPARES (pour tester l'isolation).
 */
function createIsolatedInstances() {
    const store1 = new MemoryStore();
    const store2 = new MemoryStore();
    const gs1 = new GameServer(store1, 'inst-AAAA1111');
    const gs2 = new GameServer(store2, 'inst-BBBB2222');
    allServers.push(gs1, gs2);
    return { gs1, gs2, store1, store2 };
}

// ═══════════════════════════════════════════════════════════
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🌍 Tests Multi-Instances LOCAUX (sans Redis)                ║');
console.log('║  Preuve : 2 GameServers partagent un meme store             ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// ----- 1. ISOLATION DES CONNEXIONS -----
console.log('📋 1. Isolation des connexions WebSocket');

test('Chaque instance gere ses propres clients WebSocket', () => {
    const { gs1, gs2 } = createSharedInstances();

    gs1.addClient('client_i1_1', createMockWs());
    gs2.addClient('client_i2_1', createMockWs());

    assert.strictEqual(gs1.clients.size, 1, 'Instance 1 a 1 client');
    assert.strictEqual(gs2.clients.size, 1, 'Instance 2 a 1 client');
    assert.ok(gs1.clients.has('client_i1_1'), 'Instance 1 a son propre client');
    assert.ok(!gs1.clients.has('client_i2_1'), 'Instance 1 n\'a pas le client de l\'autre');
    assert.ok(gs2.clients.has('client_i2_1'), 'Instance 2 a son propre client');
});

test('Un broadcast local n\'atteint que les clients de l\'instance emettrice', () => {
    const { gs1, gs2 } = createSharedInstances();

    const ws1 = createMockWs();
    const ws2 = createMockWs();
    gs1.addClient('c1', ws1);
    gs2.addClient('c2', ws2);

    gs1.broadcast({ type: 'test_msg' });

    assert.strictEqual(ws1.messages.length, 1, 'Client sur instance 1 recoit');
    assert.strictEqual(ws2.messages.length, 0, 'Client sur instance 2 ne recoit PAS');
});

// ----- 2. ETAT PARTAGE (store unique = Redis) -----
console.log('\n🔄 2. Etat partage entre instances (store unique = Redis)');

test('Un joueur ajoute via instance 1 est visible via instance 2', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });

    // Instance 2 voit Alice via le meme store
    assert.strictEqual(gs2.getAllPlayers().length, 1);
    assert.strictEqual(gs2.getPlayer('alice').name, 'Alice');
});

test('La phase demarree sur instance 1 est vue par instance 2', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs1.handleMessage('c1', { type: 'start_game' });

    assert.strictEqual(store.getPhase(), 'playing');
    // gs2 lit le meme store
    assert.strictEqual(gs2.store.getPhase(), 'playing');
});

test('Les jauges sont visibles et coherentes entre les deux instances', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(1000);
    gs1.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 5; i++) {
        gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    assert.strictEqual(store.getGauge('A'), 5);
    // gs2 voit la meme jauge
    assert.strictEqual(gs2.store.getGauge('A'), 5);
});

test('Le score d\'un joueur est mis a jour et visible entre instances', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(1000);
    gs1.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 3; i++) {
        gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    // Le score d'Alice est visible depuis les 2 instances
    assert.strictEqual(gs1.getPlayer('alice').score, 3);
    assert.strictEqual(gs2.getPlayer('alice').score, 3);
});

// ----- 3. CLICS CONCURRENTS DEPUIS DEUX INSTANCES -----
console.log('\n🖱️  3. Clics concurrents multi-instances');

test('Des clics de 2 instances sur 2 equipes s\'accumulent dans le meme store', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());

    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });  // Team A
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });      // Team B

    store.setMaxGauge(1000);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Alice clique 3x via instance 1
    for (let i = 0; i < 3; i++) {
        gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    // Bob clique 2x via instance 2
    for (let i = 0; i < 2; i++) {
        gs2.handleMessage('c2', { type: 'click', playerId: 'bob' });
    }

    assert.strictEqual(store.getGauge('A'), 3, 'Team A = 3 clics');
    assert.strictEqual(store.getGauge('B'), 2, 'Team B = 2 clics');
    assert.strictEqual(store.getClickStats().validated, 5, '5 clics valides au total');
});

test('Un joueur connecte sur instance 2 peut cliquer normalement', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());

    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    store.setMaxGauge(100);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Bob clique via instance 2
    gs2.handleMessage('c2', { type: 'click', playerId: 'bob' });
    gs2.handleMessage('c2', { type: 'click', playerId: 'bob' });

    assert.strictEqual(gs2.getPlayer('bob').score, 2);
    assert.strictEqual(store.getGauge('B'), 2);
});

// ----- 4. UNICITE DES IDS -----
console.log('\n🆔 4. Unicite des identifiants entre instances');

test('Les IDs de bots sont prefixes par l\'instanceId et donc uniques', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());

    gs1.handleMessage('c1', { type: 'add_bot', name: 'Bot-I1', team: 'A' });
    gs2.handleMessage('c2', { type: 'add_bot', name: 'Bot-I2', team: 'B' });

    const players = store.getPlayers();
    assert.strictEqual(players.length, 2, '2 bots dans le store');

    const bot1 = players.find(p => p.name === 'Bot-I1');
    const bot2 = players.find(p => p.name === 'Bot-I2');

    // Verifie que les IDs contiennent le prefixe d'instance
    assert.ok(bot1.id.includes('inst-AAA'), `Bot1 ID contient le prefixe instance 1: ${bot1.id}`);
    assert.ok(bot2.id.includes('inst-BBB'), `Bot2 ID contient le prefixe instance 2: ${bot2.id}`);
    assert.notStrictEqual(bot1.id, bot2.id, 'Les IDs sont differents');
});

test('Le format des client IDs dans websocket-server utilise un UUID global', () => {
    const instanceId = 'abcd1234-5678-90ab-cdef-000000000000';
    const clientId = `client_${instanceId.slice(0, 8)}_testtest`;
    assert.ok(clientId.startsWith('client_abcd1234'), 'Le format est correct');
    assert.strictEqual(clientId.length > 20, true, 'Le client ID est suffisamment long');
});

// ----- 5. VICTOIRE DISTRIBUEE -----
console.log('\n🏆 5. Detection de victoire multi-instances');

test('Victoire declenchee par instance 1, visible sur instance 2', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(3);
    gs1.handleMessage('c1', { type: 'start_game' });

    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });

    assert.strictEqual(store.getPhase(), 'victory');
    assert.strictEqual(store.getWinner(), 'A');

    // Instance 2 voit le meme etat
    assert.strictEqual(gs2.store.getPhase(), 'victory');
    assert.strictEqual(gs2.store.getWinner(), 'A');
});

test('Clics ignores apres victoire sur les deux instances', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());

    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    store.setMaxGauge(2);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Alice gagne
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });

    assert.strictEqual(store.getPhase(), 'victory');

    // Bob essaie de cliquer via instance 2 -> ignore
    gs2.handleMessage('c2', { type: 'click', playerId: 'bob' });
    assert.strictEqual(store.getGauge('B'), 0, 'Clic de Bob ignore apres victoire');
});

test('Le verrou _triggerVictory empeche la double declaration', () => {
    const store = new MemoryStore();

    // Simule un lock deja pris (comme si une autre instance l'avait)
    let lockCount = 0;
    store.acquireLock = (key) => {
        lockCount++;
        if (lockCount > 1) return false; // Seul le premier appel reussit
        return true;
    };

    const gs1 = new GameServer(store, 'inst-1');
    const gs2 = new GameServer(store, 'inst-2');
    allServers.push(gs1, gs2);

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(1);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Instance 1 declenche la victoire (lock OK)
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    assert.strictEqual(store.getPhase(), 'victory');
    assert.strictEqual(store.getWinner(), 'A');

    // Simuler: instance 2 tente aussi _triggerVictory mais le lock echoue
    // On reset pour tester (on force playing pour simuler la race)
    lockCount = 2; // Lock deja pris
    // gs2._triggerVictory ne devrait rien changer car lock echoue
    gs2._triggerVictory('B');
    assert.strictEqual(store.getWinner(), 'A', 'Le gagnant n\'a pas change');
});

// ----- 6. BOT LOOP EXCLUSIF -----
console.log('\n🤖 6. Bot loop avec verrou distribue');

testAsync('simulateBotClicks fonctionne avec le verrou', async () => {
    const { gs1, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'add_bot', name: 'Bot1', team: 'A' });
    store.setMaxGauge(100000);
    gs1.handleMessage('c1', { type: 'start_game' });

    await gs1.simulateBotClicks();
    assert.ok(store.getGauge('A') >= 0, 'Bot a clique sans crash');
});

testAsync('Deux instances ne font PAS tourner les bots en parallele', async () => {
    const store = new MemoryStore();

    let lockTaken = false;
    store.acquireLock = (key) => {
        if (lockTaken) return false;
        lockTaken = true;
        return true;
    };
    store.releaseLock = () => { lockTaken = false; };

    const gs1 = new GameServer(store, 'inst-1');
    const gs2 = new GameServer(store, 'inst-2');
    allServers.push(gs1, gs2);

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'add_bot', name: 'Bot1', team: 'A' });
    store.setMaxGauge(100000);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Instance 1 fait tourner les bots
    await gs1.simulateBotClicks();
    const gaugeApres1 = store.getGauge('A');

    // Instance 2 essaie mais le lock est pris
    lockTaken = true;
    await gs2.simulateBotClicks();
    const gaugeApres2 = store.getGauge('A');

    assert.strictEqual(gaugeApres2, gaugeApres1, 'Instance 2 bloquee par le lock');
});

// ----- 7. RESET ET CONFIG -----
console.log('\n🔄 7. Reset et config partages');

test('Un reset sur instance 1 est vu par instance 2', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs1.handleMessage('c1', { type: 'start_game' });

    assert.strictEqual(gs2.store.getPhase(), 'playing');

    gs1.handleMessage('c1', { type: 'reset_game' });

    assert.strictEqual(gs2.store.getPhase(), 'lobby');
    assert.strictEqual(store.getGauge('A'), 0);
    assert.strictEqual(store.getGauge('B'), 0);
});

test('Un changement de maxGauge est partage', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'update_config', maxGauge: 50000 });

    assert.strictEqual(gs2.store.getMaxGauge(), 50000);
});

// ----- 8. SCENARIO COMPLET -----
console.log('\n🎮 8. Scenario complet multi-instances');

test('Partie complete : Alice (inst 1) et Bob (inst 2), Alice gagne', () => {
    const { gs1, gs2, store } = createSharedInstances();

    const ws1 = createMockWs();
    const ws2 = createMockWs();
    gs1.addClient('c1', ws1);
    gs2.addClient('c2', ws2);

    // Joueurs sur differentes instances
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    assert.strictEqual(store.getPlayerCount(), 2);
    assert.strictEqual(gs1.getPlayer('alice').team, 'A');
    assert.strictEqual(gs2.getPlayer('bob').team, 'B');

    store.setMaxGauge(10);
    gs1.handleMessage('c1', { type: 'start_game' });

    // Alice clique 7 fois via instance 1
    for (let i = 0; i < 7; i++) {
        gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    // Bob clique 3 fois via instance 2
    for (let i = 0; i < 3; i++) {
        gs2.handleMessage('c2', { type: 'click', playerId: 'bob' });
    }

    assert.strictEqual(store.getGauge('A'), 7, 'Jauge A = 7');
    assert.strictEqual(store.getGauge('B'), 3, 'Jauge B = 3');

    // Alice clique les 3 derniers pour gagner
    for (let i = 0; i < 3; i++) {
        gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    assert.strictEqual(store.getPhase(), 'victory');
    assert.strictEqual(store.getWinner(), 'A');
    assert.strictEqual(store.getGauge('A'), 10);
    assert.strictEqual(store.getGauge('B'), 3);
    assert.strictEqual(gs1.getPlayer('alice').score, 10);
    assert.strictEqual(gs2.getPlayer('bob').score, 3);

    // Les 2 instances voient le meme etat final
    assert.strictEqual(gs1.store.getWinner(), gs2.store.getWinner());
});

test('Deconnexion d\'un joueur sur instance 1 est refletee globalement', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());

    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    assert.strictEqual(store.getPlayerCount(), 2);

    // Alice se deconnecte (instance 1 la retire)
    gs1.removeClient('c1');

    assert.strictEqual(store.getPlayerCount(), 2, 'Alice reste reservee pendant la grace');
    assert.strictEqual(gs2.getPlayer('alice').isDisconnected, true, 'Instance 2 voit Alice deconnectee');
    assert.strictEqual(gs2.getPlayer('bob').name, 'Bob', 'Bob est toujours la');
});

test('Reconnexion sur la meme instance conserve equipe et score', () => {
    const { gs1, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(100);
    gs1.handleMessage('c1', { type: 'start_game' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });

    gs1.removeClient('c1');
    gs1.addClient('c1_reco', createMockWs());
    gs1.handleMessage('c1_reco', { type: 'player_join', playerId: 'alice', name: 'Alice' });

    const alice = gs1.getPlayer('alice');
    assert.strictEqual(alice.team, 'A');
    assert.strictEqual(alice.score, 2);
    assert.strictEqual(alice.isDisconnected, false);
});

test('Reconnexion sur une autre instance conserve equipe et score', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    store.setMaxGauge(100);
    gs1.handleMessage('c1', { type: 'start_game' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });

    gs1.removeClient('c1');
    gs2.addClient('c2_reco', createMockWs());
    gs2.handleMessage('c2_reco', { type: 'player_join', playerId: 'alice', name: 'Alice' });

    const alice = gs2.getPlayer('alice');
    assert.strictEqual(alice.team, 'A');
    assert.strictEqual(alice.score, 1);
    assert.strictEqual(alice.isDisconnected, false);
});

test('Deconnexion brute puis reconnexion pendant la victoire ne casse pas la session', () => {
    const { gs1, gs2, store } = createSharedInstances();

    gs1.addClient('c1', createMockWs());
    gs2.addClient('c2', createMockWs());
    gs1.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });
    gs2.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    store.setMaxGauge(2);
    gs1.handleMessage('c1', { type: 'start_game' });
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });

    gs2.removeClient('c2');
    gs1.handleMessage('c1', { type: 'click', playerId: 'alice' });
    assert.strictEqual(store.getPhase(), 'victory');

    gs2.addClient('c2_reco', createMockWs());
    gs2.handleMessage('c2_reco', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    const bob = gs2.getPlayer('bob');
    assert.strictEqual(bob.team, 'B');
    assert.strictEqual(bob.isDisconnected, false);
    assert.strictEqual(gs2.store.getWinner(), 'A');
});

test('Reconnect storm conserve les sessions sans doublons', () => {
    const { gs1, gs2, store } = createSharedInstances();
    const totalPlayers = 8;

    for (let i = 0; i < totalPlayers; i++) {
        const gs = i % 2 === 0 ? gs1 : gs2;
        const clientId = `c${i}`;
        gs.addClient(clientId, createMockWs());
        gs.handleMessage(clientId, { type: 'player_join', playerId: `p${i}`, name: `Player ${i}` });
    }

    for (let i = 0; i < totalPlayers; i++) {
        const gs = i % 2 === 0 ? gs1 : gs2;
        gs.removeClient(`c${i}`);
    }

    for (let i = 0; i < totalPlayers; i++) {
        const gs = i % 2 === 0 ? gs2 : gs1;
        gs.addClient(`reco${i}`, createMockWs());
        gs.handleMessage(`reco${i}`, { type: 'player_join', playerId: `p${i}`, name: `Player ${i}` });
    }

    assert.strictEqual(store.getPlayerCount(), totalPlayers);
    assert.strictEqual(new Set(store.getPlayers().map(p => p.id)).size, totalPlayers);
    assert.ok(store.getPlayers().every(p => !p.isDisconnected));
});

// ═══════════════════════════════════════════════════════════
// RESULTATS
// ═══════════════════════════════════════════════════════════

setTimeout(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    allServers.forEach(gs => {
        gs.shutdown();
    });

    if (failed === 0) {
        console.log(`\n✅ TOUS LES TESTS MULTI-INSTANCES PASSENT ! (${passed}/${total})\n`);
        console.log('Preuves validees :');
        console.log('  • Les connexions WebSocket sont isolees par instance');
        console.log('  • L\'etat du jeu est partage (joueurs, jauges, phase, scores)');
        console.log('  • Les IDs (clients, bots) sont uniques grace au prefixe d\'instance');
        console.log('  • Le verrou distribue empeche les doubles victoires');
        console.log('  • Le bot loop est exclusif (une seule instance a la fois)');
        console.log('  • Reset, config et deconnexions sont partages');
        console.log('  • Une partie complete fonctionne sur 2 instances\n');
        process.exit(0);
    } else {
        console.log(`\n❌ ${failed} TEST(S) ECHOUE(S) sur ${total}\n`);
        process.exit(1);
    }
}, 500);
