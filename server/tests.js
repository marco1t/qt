#!/usr/bin/env node

/**
 * tests.js - Tests fonctionnels du GameServer (Architecture Multi-Instances)
 *
 * Verifie que toutes les fonctionnalites du jeu fonctionnent avec l'architecture
 * deleguee au SharedStateStore (MemoryStore par defaut).
 *
 * Usage: node tests.js
 */

const assert = require('assert');
const GameServer = require('./GameServer');
const { MemoryStore } = require('./SharedStateStore');

let passed = 0;
let failed = 0;
let total = 0;

const allServers = [];

function createMockWs() {
    return {
        readyState: 1,
        send: function () { },
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

function createServer() {
    const store = new MemoryStore();
    const gs = new GameServer(store, 'test-instance-1');
    allServers.push(gs);
    return gs;
}

function createServerWithPlayer(playerName, playerId, clientId) {
    const gs = createServer();
    const ws = createMockWs();
    clientId = clientId || 'client_1';
    playerId = playerId || 'player_1';
    playerName = playerName || 'TestPlayer';

    gs.addClient(clientId, ws);
    gs.handleMessage(clientId, {
        type: 'player_join',
        playerId: playerId,
        name: playerName,
    });

    return gs;
}

// Raccourci pour lire l'etat depuis le store en memoire dans les tests
const getStoreState = (gs) => gs.store.state;

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║      🧪 Tests Fonctionnels - ClickWars (SharedStore)     ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// ----- 1. INITIALISATION -----
console.log('📋 1. Initialisation du serveur');

test('Le serveur démarre en phase lobby', () => {
    const gs = createServer();
    assert.strictEqual(gs.store.getPhase(), 'lobby');
});

test('Les jauges démarrent à 0', () => {
    const gs = createServer();
    assert.strictEqual(gs.store.getGauge('A'), 0);
    assert.strictEqual(gs.store.getGauge('B'), 0);
});

test('La jauge max par défaut est 100000', () => {
    const gs = createServer();
    assert.strictEqual(gs.store.getMaxGauge(), 100000);
});

test('Pas de gagnant au départ', () => {
    const gs = createServer();
    assert.strictEqual(gs.store.getWinner(), null);
});

test('Aucun joueur au départ', () => {
    const gs = createServer();
    assert.strictEqual(gs.getAllPlayers().length, 0);
});

// ----- 2. JOUEURS -----
console.log('\n👤 2. Gestion des joueurs');

test('Un joueur peut rejoindre', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    assert.strictEqual(gs.getAllPlayers().length, 1);
    assert.strictEqual(gs.getPlayer('p1').name, 'Alice');
});

test('Le 1er joueur va dans l\'équipe A', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    assert.strictEqual(gs.getPlayer('p1').team, 'A');
});

test('Le 2ème joueur va dans l\'équipe B (auto-équilibrage)', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    const ws2 = createMockWs();
    gs.addClient('c2', ws2);
    gs.handleMessage('c2', { type: 'player_join', playerId: 'p2', name: 'Bob' });

    assert.strictEqual(gs.getPlayer('p1').team, 'A');
    assert.strictEqual(gs.getPlayer('p2').team, 'B');
});

test('Un joueur peut être retrouvé par ID', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    const player = gs.getPlayer('p1');
    assert.notStrictEqual(player, null);
    assert.strictEqual(player.name, 'Alice');
});

test('Un joueur inconnu retourne null', () => {
    const gs = createServer();
    assert.strictEqual(gs.getPlayer('inconnu'), null);
});

test('Un joueur déconnecté est retiré', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    assert.strictEqual(gs.getAllPlayers().length, 1);
    gs.removeClient('c1');
    assert.strictEqual(gs.getAllPlayers().length, 0);
});

// ----- 3. CLICS ET JAUGES -----
console.log('\n🖱️  3. Clics et jauges');

test('Un clic incrémente la jauge de l\'équipe du joueur', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.store.getGauge('A'), 1);
});

test('Un clic incrémente le score du joueur', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.getPlayer('p1').score, 1);
});

test('Les clics ne comptent PAS en phase lobby', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.store.getGauge('A'), 0);
});

test('La jauge ne dépasse pas le max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setMaxGauge(5);
    gs.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 20; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    }

    assert.strictEqual(gs.store.getGauge('A'), 5);
});

// ----- 4. VICTOIRE -----
console.log('\n🏆 4. Détection de victoire');

test('Victoire détectée quand jauge = max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setMaxGauge(3);
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.store.getPhase(), 'victory');
    assert.strictEqual(gs.store.getWinner(), 'A');
});

test('Pas de victoire si jauge < max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setMaxGauge(100);
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.store.getPhase(), 'playing');
});

test('Les clics sont ignorés après victoire', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setMaxGauge(2);
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Victoire
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Ignore

    assert.strictEqual(gs.store.getGauge('A'), 2);
});

// ----- 5. START / RESET -----
console.log('\n🔄 5. Start et Reset du jeu');

test('Start passe en phase playing', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    assert.strictEqual(gs.store.getPhase(), 'playing');
});

test('Start remet les jauges à 0', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setGauge('A', 50);
    gs.handleMessage('c1', { type: 'start_game' });

    assert.strictEqual(gs.store.getGauge('A'), 0);
    assert.strictEqual(gs.store.getGauge('B'), 0);
});

test('Reset revient en phase lobby', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'reset_game' });

    assert.strictEqual(gs.store.getPhase(), 'lobby');
    assert.strictEqual(gs.store.getGauge('A'), 0);
    assert.strictEqual(gs.store.getGauge('B'), 0);
    assert.strictEqual(gs.store.getWinner(), null);
});

// ----- 6. BOTS -----
console.log('\n🤖 6. Gestion des bots');

test('Un bot peut être ajouté', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'add_bot', name: 'Bot1', team: 'A' });
    assert.strictEqual(gs.getAllPlayers().length, 1);
    assert.strictEqual(gs.getAllPlayers()[0].isBot, true);
});

test('Un bot peut être retiré', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'add_bot', name: 'Bot1', team: 'A' });
    const botId = gs.getAllPlayers()[0].id;

    gs.handleMessage('c1', { type: 'remove_bot', botId: botId });
    assert.strictEqual(gs.getAllPlayers().length, 0);
});

// ----- 7. CONFIGURATION -----
console.log('\n⚙️  7. Configuration');

test('maxGauge peut être modifié', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'update_config', maxGauge: 500 });
    assert.strictEqual(gs.store.getMaxGauge(), 500);
});

// ----- 8. SCÉNARIO COMPLET -----
console.log('\n🎮 8. Scénario de jeu complet');

test('Partie complète : 2 joueurs, équipe A gagne', () => {
    const gs = createServer();
    gs.store.setMaxGauge(10);

    const ws1 = createMockWs();
    gs.addClient('c1', ws1);
    gs.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });

    const ws2 = createMockWs();
    gs.addClient('c2', ws2);
    gs.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    gs.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 10; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    assert.strictEqual(gs.store.getPhase(), 'victory');
    assert.strictEqual(gs.store.getWinner(), 'A');
    assert.strictEqual(gs.getPlayer('alice').score, 10);
});

// ----- 9. STATISTIQUES -----
console.log('\n📊 9. Statistiques');

test('getStats retourne les bonnes informations', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    const stats = gs.getStats();

    assert.strictEqual(stats.phase, 'lobby');
    assert.strictEqual(stats.clients, 1);
    assert.strictEqual(stats.players, 1);
});

test('clickStats comptabilise correctement', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.store.setMaxGauge(3);
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Victoire ici

    const stats = gs.store.getClickStats();
    assert.strictEqual(stats.validated, 3);
    assert.strictEqual(stats.total, 3);
});

// =============================================
// RÉSULTATS
// =============================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

allServers.forEach(gs => {
    gs.stopBotLoop();
    if (gs.pendingBroadcast) clearTimeout(gs.pendingBroadcast);
});

if (failed === 0) {
    console.log(`\n✅ TOUS LES TESTS PASSENT ! (${passed}/${total})\n`);
    process.exit(0);
} else {
    console.log(`\n❌ ${failed} TEST(S) ÉCHOUÉ(S) sur ${total}\n`);
    process.exit(1);
}
