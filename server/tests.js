#!/usr/bin/env node

/**
 * tests.js - Tests fonctionnels du GameServer
 *
 * Vérifie que toutes les fonctionnalités du jeu fonctionnent correctement.
 * Aucune dépendance externe requise (utilise uniquement assert de Node.js).
 *
 * Usage: node tests.js
 */

const assert = require('assert');
const GameServer = require('./GameServer');

// Compteurs
let passed = 0;
let failed = 0;
let total = 0;

// Tracking de toutes les instances pour cleanup
const allServers = [];

// Fonction utilitaire pour créer un faux WebSocket
function createMockWs() {
    return {
        readyState: 1, // OPEN
        send: function () { }, // Ne fait rien
    };
}

// Fonction pour exécuter un test
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

// =============================================
// Helper : créer un serveur prêt à l'emploi
// =============================================
function createServer() {
    const gs = new GameServer();
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

// =============================================
// TESTS
// =============================================

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║      🧪 Tests Fonctionnels - ClickWars GameServer       ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// ----- 1. INITIALISATION -----
console.log('📋 1. Initialisation du serveur');

test('Le serveur démarre en phase lobby', () => {
    const gs = createServer();
    assert.strictEqual(gs.state.phase, 'lobby');
});

test('Les jauges démarrent à 0', () => {
    const gs = createServer();
    assert.strictEqual(gs.state.teamA.gauge, 0);
    assert.strictEqual(gs.state.teamB.gauge, 0);
});

test('La jauge max par défaut est 100', () => {
    const gs = createServer();
    assert.strictEqual(gs.state.config.maxGauge, 100);
});

test('Pas de gagnant au départ', () => {
    const gs = createServer();
    assert.strictEqual(gs.state.winner, null);
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

test('Auto-équilibrage : 3 joueurs = 2A + 1B', () => {
    const gs = createServer();

    const ws1 = createMockWs();
    gs.addClient('c1', ws1);
    gs.handleMessage('c1', { type: 'player_join', playerId: 'p1', name: 'J1' });

    const ws2 = createMockWs();
    gs.addClient('c2', ws2);
    gs.handleMessage('c2', { type: 'player_join', playerId: 'p2', name: 'J2' });

    const ws3 = createMockWs();
    gs.addClient('c3', ws3);
    gs.handleMessage('c3', { type: 'player_join', playerId: 'p3', name: 'J3' });

    assert.strictEqual(gs.state.teamA.players.length, 2);
    assert.strictEqual(gs.state.teamB.players.length, 1);
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

    assert.strictEqual(gs.state.teamA.gauge, 1);
});

test('Un clic incrémente le score du joueur', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.getPlayer('p1').score, 1);
});

test('Les clics ne comptent PAS en phase lobby', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    // On ne démarre PAS le jeu
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.state.teamA.gauge, 0);
});

test('10 clics = jauge à 10', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 10; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    }

    assert.strictEqual(gs.state.teamA.gauge, 10);
    assert.strictEqual(gs.getPlayer('p1').score, 10);
});

test('La jauge ne dépasse pas le max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.state.config.maxGauge = 5;
    gs.handleMessage('c1', { type: 'start_game' });

    for (let i = 0; i < 20; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    }

    assert.strictEqual(gs.state.teamA.gauge, 5); // Max atteint
});

// ----- 4. VICTOIRE -----
console.log('\n🏆 4. Détection de victoire');

test('Victoire détectée quand jauge = max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.state.config.maxGauge = 3;
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.state.phase, 'victory');
    assert.strictEqual(gs.state.winner, 'A');
});

test('Pas de victoire si jauge < max', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.state.config.maxGauge = 100;
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });

    assert.strictEqual(gs.state.phase, 'playing');
    assert.strictEqual(gs.state.winner, null);
});

test('Les clics sont ignorés après victoire', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.state.config.maxGauge = 2;
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Victoire ici
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Ignoré

    assert.strictEqual(gs.state.teamA.gauge, 2); // Pas 3
});

// ----- 5. START / RESET -----
console.log('\n🔄 5. Start et Reset du jeu');

test('Start passe en phase playing', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });

    assert.strictEqual(gs.state.phase, 'playing');
});

test('Start remet les jauges à 0', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.state.teamA.gauge = 50;
    gs.handleMessage('c1', { type: 'start_game' });

    assert.strictEqual(gs.state.teamA.gauge, 0);
    assert.strictEqual(gs.state.teamB.gauge, 0);
});

test('Start remet les scores joueurs à 0', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    assert.strictEqual(gs.getPlayer('p1').score, 1);

    gs.handleMessage('c1', { type: 'start_game' }); // Restart
    assert.strictEqual(gs.getPlayer('p1').score, 0);
});

test('Reset revient en phase lobby', () => {
    const gs = createServerWithPlayer('Alice', 'p1', 'c1');
    gs.handleMessage('c1', { type: 'start_game' });
    gs.handleMessage('c1', { type: 'reset_game' });

    assert.strictEqual(gs.state.phase, 'lobby');
    assert.strictEqual(gs.state.teamA.gauge, 0);
    assert.strictEqual(gs.state.teamB.gauge, 0);
    assert.strictEqual(gs.state.winner, null);
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

test('Un bot est dans la bonne équipe', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'add_bot', name: 'BotRouge', team: 'A' });
    gs.handleMessage('c1', { type: 'add_bot', name: 'BotBleu', team: 'B' });

    assert.strictEqual(gs.state.teamA.players.length, 1);
    assert.strictEqual(gs.state.teamB.players.length, 1);
    assert.strictEqual(gs.state.teamA.players[0].name, 'BotRouge');
    assert.strictEqual(gs.state.teamB.players[0].name, 'BotBleu');
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

test('Plusieurs bots peuvent être ajoutés', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    for (let i = 0; i < 50; i++) {
        gs.handleMessage('c1', { type: 'add_bot', name: `Bot_${i}`, team: i % 2 === 0 ? 'A' : 'B' });
    }

    assert.strictEqual(gs.getAllPlayers().length, 50);
    assert.strictEqual(gs.state.teamA.players.length, 25);
    assert.strictEqual(gs.state.teamB.players.length, 25);
});

test('Les bots auto-équilibrent quand pas d\'équipe spécifiée', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    // Ajouter sans spécifier l'équipe
    gs.handleMessage('c1', { type: 'add_bot', name: 'Bot1' });
    gs.handleMessage('c1', { type: 'add_bot', name: 'Bot2' });

    assert.strictEqual(gs.state.teamA.players.length, 1);
    assert.strictEqual(gs.state.teamB.players.length, 1);
});

// ----- 7. CONFIGURATION -----
console.log('\n⚙️  7. Configuration');

test('maxGauge peut être modifié', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'update_config', maxGauge: 500 });
    assert.strictEqual(gs.state.config.maxGauge, 500);
});

test('maxGauge < 10 est ignoré', () => {
    const gs = createServer();
    const ws = createMockWs();
    gs.addClient('c1', ws);

    gs.handleMessage('c1', { type: 'update_config', maxGauge: 5 });
    assert.strictEqual(gs.state.config.maxGauge, 100); // Pas changé
});

// ----- 8. SCÉNARIO COMPLET -----
console.log('\n🎮 8. Scénario de jeu complet');

test('Partie complète : 2 joueurs, équipe A gagne', () => {
    const gs = createServer();
    gs.state.config.maxGauge = 10;

    // 2 joueurs
    const ws1 = createMockWs();
    gs.addClient('c1', ws1);
    gs.handleMessage('c1', { type: 'player_join', playerId: 'alice', name: 'Alice' });

    const ws2 = createMockWs();
    gs.addClient('c2', ws2);
    gs.handleMessage('c2', { type: 'player_join', playerId: 'bob', name: 'Bob' });

    // Vérifier équilibrage
    assert.strictEqual(gs.getPlayer('alice').team, 'A');
    assert.strictEqual(gs.getPlayer('bob').team, 'B');

    // Démarrer
    gs.handleMessage('c1', { type: 'start_game' });
    assert.strictEqual(gs.state.phase, 'playing');

    // Alice clique 10 fois → victoire
    for (let i = 0; i < 10; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: 'alice' });
    }

    assert.strictEqual(gs.state.phase, 'victory');
    assert.strictEqual(gs.state.winner, 'A');
    assert.strictEqual(gs.getPlayer('alice').score, 10);

    // Reset
    gs.handleMessage('c1', { type: 'reset_game' });
    assert.strictEqual(gs.state.phase, 'lobby');
    assert.strictEqual(gs.state.teamA.gauge, 0);
    assert.strictEqual(gs.getPlayer('alice').score, 0);
});

test('Partie complète : bots, équipe B gagne', () => {
    const gs = createServer();
    gs.state.config.maxGauge = 5;

    const ws = createMockWs();
    gs.addClient('c1', ws);

    // Ajouter un joueur + des bots
    gs.handleMessage('c1', { type: 'player_join', playerId: 'mike', name: 'Mike' });
    gs.handleMessage('c1', { type: 'add_bot', name: 'BotB', team: 'B' });

    // Mike est en A, BotB en B
    assert.strictEqual(gs.getPlayer('mike').team, 'A');

    // Démarrer et faire gagner B manuellement
    gs.handleMessage('c1', { type: 'start_game' });
    const botId = gs.state.teamB.players[0].id;

    for (let i = 0; i < 5; i++) {
        gs.handleMessage('c1', { type: 'click', playerId: botId });
    }

    assert.strictEqual(gs.state.phase, 'victory');
    assert.strictEqual(gs.state.winner, 'B');
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
    gs.state.config.maxGauge = 3;
    gs.handleMessage('c1', { type: 'start_game' });

    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' });
    gs.handleMessage('c1', { type: 'click', playerId: 'p1' }); // Victoire

    assert.strictEqual(gs.clickStats.validated, 3);
    assert.strictEqual(gs.clickStats.total, 3);
});

// =============================================
// RÉSULTATS
// =============================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Cleanup : arrêter toutes les bot loops et timeouts
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
