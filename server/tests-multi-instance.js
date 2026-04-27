#!/usr/bin/env node

/**
 * tests-multi-instance.js - Tests du SharedStateStore avec Redis
 * 
 * Verifie que deux GameServer distincts utilisant le RedisStore 
 * partagent bien le meme etat de jeu et communiquent via pub/sub.
 * 
 * PRE-REQUIS : Un serveur Redis doit etre lance en local (localhost:6379)
 * 
 * Usage: node tests-multi-instance.js
 */

const assert = require('assert');
const GameServer = require('./GameServer');
const { RedisStore } = require('./SharedStateStore');

// Verification qu'un serveur Redis est indique, sinon on utilise le localhost par defaut
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║      🌍 Tests Multi-Instances - ClickWars (Redis)        ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

async function runTests() {
    let store1, store2;
    let gs1, gs2;
    
    try {
        console.log(`🔌 Connexion au serveur Redis sur ${REDIS_URL}...`);
        
        // Instance 1
        store1 = new RedisStore(REDIS_URL, 'instance-1');
        await store1.connect();
        
        // Vider la base de données Redis pour un test propre
        await store1.redis.flushall();
        store1.state.teamA.players = [];
        store1.state.teamB.players = [];
        store1.clearDisconnectedPlayers();
        store1.resetGame();
        console.log('✅ Base Redis nettoye');
        
        gs1 = new GameServer(store1, 'instance-1');

        // Instance 2
        store2 = new RedisStore(REDIS_URL, 'instance-2');
        await store2.connect();
        gs2 = new GameServer(store2, 'instance-2');
        
        console.log('✅ 2 Instances serveur demarrees\n');

        // Mock WebSocket clients
        function createMockWs() { return { readyState: 1, send: function() {} }; }
        
        // Configuration de la reception de messages inter-instances
        const broadcastMessages2 = [];
        store2.onBroadcastReceived = (msg) => {
            broadcastMessages2.push(msg);
        };
        const broadcastMessages1 = [];
        store1.onBroadcastReceived = (msg) => {
            broadcastMessages1.push(msg);
        };

        // -------------------------------------------------------------
        // TEST 1 : Un joueur rejoint sur Instance 1, il doit apparaitre sur Instance 2
        // -------------------------------------------------------------
        console.log('Test 1 : Partage de la liste des joueurs');
        gs1.addClient('client_i1_a', createMockWs());
        gs1.handleMessage('client_i1_a', { type: 'player_join', playerId: 'player_a', name: 'Alice' });

        // Attente asynchrone pour l'écriture Redis
        await new Promise(r => setTimeout(r, 100));

        let players2 = store2.getPlayers();
        assert.strictEqual(players2.length, 1, "Instance 2 doit voir 1 joueur");
        assert.strictEqual(players2[0].name, 'Alice', "Instance 2 doit voir Alice");
        console.log('  ✅ Un joueur connecte sur l\'instance 1 est vu par l\'instance 2');

        // -------------------------------------------------------------
        // TEST 2 : Changement de phase (Démarrage du jeu) partagé
        // -------------------------------------------------------------
        console.log('\nTest 2 : Partage de la phase de jeu');
        gs1.handleMessage('client_i1_a', { type: 'start_game' });
        
        await new Promise(r => setTimeout(r, 100));
        
        let phase2 = store2.getPhase();
        assert.strictEqual(phase2, 'playing', "Instance 2 doit voir le jeu en cours");
        console.log('  ✅ Le mode "playing" demarre sur l\'instance 1 est vu sur l\'instance 2');

        // -------------------------------------------------------------
        // TEST 3 : Clics cumulatifs depuis les deux instances
        // -------------------------------------------------------------
        console.log('\nTest 3 : Partage des jauges (clics concurrents)');
        gs2.addClient('client_i2_b', createMockWs());
        gs2.handleMessage('client_i2_b', { type: 'player_join', playerId: 'player_b', name: 'Bob' });
        
        await new Promise(r => setTimeout(r, 100)); // Laisse Bob rejoindre
        
        // Alice clique sur l'instance 1
        gs1.handleMessage('client_i1_a', { type: 'click', playerId: 'player_a' });
        
        // Bob clique sur l'instance 2
        gs2.handleMessage('client_i2_b', { type: 'click', playerId: 'player_b' });
        
        await new Promise(r => setTimeout(r, 100));
        
        let gaugeA = store1.getGauge('A');
        let gaugeB = store1.getGauge('B');
        
        assert.strictEqual(gaugeA, 1, "La Team A doit avoir 1 clic (depuis Alice sur Inst 1)");
        assert.strictEqual(gaugeB, 1, "La Team B doit avoir 1 clic (depuis Bob sur Inst 2)");
        console.log('  ✅ L\'instance 1 et 2 partagent bien les memes jauges accumulees');

        // -------------------------------------------------------------
        // TEST 3B : Reconnexion cross-instance avec conservation session
        // -------------------------------------------------------------
        console.log('\nTest 3B : Reconnexion cross-instance');
        gs1.removeClient('client_i1_a');
        await new Promise(r => setTimeout(r, 100));

        assert.strictEqual(store2.getPlayer('player_a').isDisconnected, true, "Instance 2 doit voir Alice deconnectee");

        gs2.addClient('client_i2_a_reco', createMockWs());
        gs2.handleMessage('client_i2_a_reco', { type: 'player_join', playerId: 'player_a', name: 'Alice' });
        await new Promise(r => setTimeout(r, 100));

        const aliceAfterReconnect = store1.getPlayer('player_a');
        assert.strictEqual(aliceAfterReconnect.team, 'A', "Alice garde son equipe");
        assert.strictEqual(aliceAfterReconnect.score, 1, "Alice garde son score");
        assert.strictEqual(aliceAfterReconnect.isDisconnected, false, "Alice est reconnectee globalement");
        console.log('  ✅ Un joueur reconnecte sur une autre instance garde son etat');

        // -------------------------------------------------------------
        // TEST 4 : Communication Pub/Sub (Relais de broadcast)
        // -------------------------------------------------------------
        console.log('\nTest 4 : Communication Pub/Sub');
        
        assert.ok(broadcastMessages2.length > 0, "L'instance 2 a du recevoir des broadcasts via pub/sub");
        const stateUpdates = broadcastMessages2.filter(m => m.type === 'state_update' || m.type === 'lobby_update');
        assert.ok(stateUpdates.length > 0, "L'instance 2 a du recevoir des state_update via pub/sub");
        console.log('  ✅ Les messages de type broadcast sont bien relayes entre instances');

        // -------------------------------------------------------------
        // TEST 5 : Verouillage de la Victoire (Dernier Clic Unique)
        // -------------------------------------------------------------
        console.log('\nTest 5 : Verouillage distribué (Lock) de la condition de victoire');
        
        store1.setMaxGauge(3);
        
        // On clique encore 1 fois sur chaque equipe 
        // A est à 2, B est à 2
        gs1.handleMessage('client_i1_a', { type: 'click', playerId: 'player_a' });
        gs2.handleMessage('client_i2_b', { type: 'click', playerId: 'player_b' });
        
        await new Promise(r => setTimeout(r, 100));
        
        // Concurrence : Les deux cliquent en meme temps pour atteindre la cible de 3!
        // On declenche les deux appels "en meme temps"
        gs1.handleMessage('client_i1_a', { type: 'click', playerId: 'player_a' });
        gs2.handleMessage('client_i2_b', { type: 'click', playerId: 'player_b' });
        
        await new Promise(r => setTimeout(r, 200));
        
        let victoryWinner1 = store1.getWinner();
        let victoryWinner2 = store2.getWinner();
        
        assert.ok(victoryWinner1 === 'A' || victoryWinner1 === 'B', "Il doit y avoir un seul gagnant resolu");
        assert.strictEqual(victoryWinner1, victoryWinner2, "Les deux instances doivent d'accorder sur le meme gagnant");
        console.log(`  ✅ L'election de la victoire est unique et distribuee (Gagnant : ${victoryWinner1})`);


        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ TOUS LES TESTS MULTI-INSTANCES PASSENT !\n');


    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n⚠️  Test ignore: Le serveur Redis n\'est pas lance localement.');
            console.log('    Pour valider ce test, lancez "redis-server" dans un terminal.\n');
        } else {
            console.error('\n❌ ECHEC DES TESTS MULTI-INSTANCES :');
            console.error(error);
            process.exitCode = 1;
        }
    } finally {
        console.log('Nettoyage et deconnexion...');
        if (gs1) gs1.shutdown();
        if (gs2) gs2.shutdown();
        if (store1) await store1.disconnect();
        if (store2) await store2.disconnect();
    }
}

runTests();
