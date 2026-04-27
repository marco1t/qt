#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SessionManager = require('./SessionManager');

const REDIS_URL = process.env.REDIS_URL || null;
const REPORT_JSON = process.env.REPORT_JSON || path.join(os.tmpdir(), 'clickwars-session-routing-report.json');

let passed = 0;
let failed = 0;
const results = [];
const managers = [];

function createMockWs() {
    const messages = [];
    return {
        readyState: 1,
        send(data) {
            messages.push(JSON.parse(data));
        },
        messages
    };
}

async function createManager(instanceId) {
    const manager = new SessionManager({ instanceId, redisUrl: REDIS_URL });
    await manager.initDefault();
    managers.push(manager);
    return manager;
}

async function test(name, fn) {
    const startedAt = Date.now();
    try {
        await fn();
        passed++;
        results.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        results.push({ name, status: 'failed', error: error.message, durationMs: Date.now() - startedAt });
        console.log(`  ❌ ${name}`);
        console.log(`     → ${error.message}`);
    }
}

async function flushRedisIfNeeded() {
    if (!REDIS_URL) return;
    const Redis = require('ioredis');
    const redis = new Redis(REDIS_URL);
    await redis.flushall();
    await redis.quit();
}

function lastMessage(ws, type) {
    return [...ws.messages].reverse().find(message => message.type === type);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function shutdownManagers() {
    while (managers.length > 0) {
        const manager = managers.pop();
        await manager.shutdown();
    }
}

async function run() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🧭 Tests Sessions, Failure Recovery & Routing               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    await flushRedisIfNeeded();

    await test('Compat legacy : player_join sans sessionId rejoint default', async () => {
        const manager = await createManager('route-legacy');
        const ws = createMockWs();

        await manager.handleMessage('c1', ws, { type: 'player_join', playerId: 'p1', name: 'Alice' });

        assert.strictEqual(lastMessage(ws, 'session_joined').sessionId, 'default');
        assert.strictEqual(manager.sessions.get('default').server.getPlayer('p1').name, 'Alice');
    });

    await test('Routage invalide : session explicite inconnue retourne SESSION_NOT_FOUND', async () => {
        const manager = await createManager('route-error');
        const ws = createMockWs();

        await manager.handleMessage('c404', ws, {
            type: 'player_join',
            sessionId: 'missing-session',
            playerId: 'p404',
            name: 'Lost'
        });

        const error = lastMessage(ws, 'session_error');
        assert.ok(error, 'session_error attendu');
        assert.strictEqual(error.code, 'SESSION_NOT_FOUND');
    });

    await test('Isolation : deux sessions ne partagent ni joueurs, ni jauges, ni phase', async () => {
        const manager = await createManager('route-isolation');
        const wsA = createMockWs();
        const wsB = createMockWs();

        await manager.handleMessage('admin-a', wsA, { type: 'create_session', sessionId: 'route-a' });
        await manager.handleMessage('admin-b', wsB, { type: 'create_session', sessionId: 'route-b' });
        await manager.handleMessage('c-a', wsA, { type: 'player_join', sessionId: 'route-a', playerId: 'alice', name: 'Alice' });
        await manager.handleMessage('c-b', wsB, { type: 'player_join', sessionId: 'route-b', playerId: 'bob', name: 'Bob' });
        await manager.handleMessage('c-a', wsA, { type: 'update_config', sessionId: 'route-a', maxGauge: 1000 });
        await manager.handleMessage('c-a', wsA, { type: 'start_game', sessionId: 'route-a' });
        await manager.handleMessage('c-a', wsA, { type: 'click', sessionId: 'route-a', playerId: 'alice' });

        const storeA = manager.sessions.get('route-a').store;
        const storeB = manager.sessions.get('route-b').store;

        assert.strictEqual(storeA.getPhase(), 'playing');
        assert.strictEqual(storeB.getPhase(), 'lobby');
        assert.strictEqual(storeA.getGauge('A'), 1);
        assert.strictEqual(storeB.getGauge('A'), 0);
        assert.strictEqual(storeA.getPlayers().length, 1);
        assert.strictEqual(storeB.getPlayers().length, 1);
    });

    if (REDIS_URL) {
        await test('Redis recovery : une session survit a la perte d\'une instance', async () => {
            const managerA = await createManager('route-inst-a');
            const wsA = createMockWs();

            await managerA.handleMessage('admin-a', wsA, { type: 'create_session', sessionId: 'persist-a' });
            await managerA.handleMessage('c-a', wsA, { type: 'player_join', sessionId: 'persist-a', playerId: 'alice', name: 'Alice' });
            await managerA.handleMessage('c-a', wsA, { type: 'update_config', sessionId: 'persist-a', maxGauge: 1000 });
            await managerA.handleMessage('c-a', wsA, { type: 'start_game', sessionId: 'persist-a' });
            await managerA.handleMessage('c-a', wsA, { type: 'click', sessionId: 'persist-a', playerId: 'alice' });
            await sleep(700);
            await managerA.shutdown();
            managers.splice(managers.indexOf(managerA), 1);

            const managerB = await createManager('route-inst-b');
            const wsB = createMockWs();
            await managerB.handleMessage('c-b', wsB, { type: 'player_join', sessionId: 'persist-a', playerId: 'alice', name: 'Alice' });

            const player = managerB.sessions.get('persist-a').server.getPlayer('alice');
            assert.strictEqual(player.team, 'A');
            assert.strictEqual(player.score, 1);
            assert.strictEqual(managerB.sessions.get('persist-a').store.getPhase(), 'playing');
            assert.strictEqual(lastMessage(wsB, 'session_joined').restored, true);
        });

        await test('Redis routing : deux instances rejoignent la meme session coherente', async () => {
            const managerA = await createManager('shared-inst-a');
            const managerB = await createManager('shared-inst-b');
            const wsA = createMockWs();
            const wsB = createMockWs();

            await managerA.handleMessage('admin-shared', wsA, { type: 'create_session', sessionId: 'shared-route' });
            await managerA.handleMessage('c-a', wsA, { type: 'player_join', sessionId: 'shared-route', playerId: 'alice', name: 'Alice' });
            await sleep(500);
            await managerB.handleMessage('c-b', wsB, { type: 'player_join', sessionId: 'shared-route', playerId: 'bob', name: 'Bob' });
            await sleep(500);

            const playersA = managerA.sessions.get('shared-route').store.getPlayers().map(p => p.id).sort();
            const playersB = managerB.sessions.get('shared-route').store.getPlayers().map(p => p.id).sort();
            assert.deepStrictEqual(playersA, ['alice', 'bob']);
            assert.deepStrictEqual(playersB, ['alice', 'bob']);
        });

        await test('Redis routing : joins concurrents sur une session explicite ne dupliquent pas le store local', async () => {
            const managerA = await createManager('race-inst-a');
            const managerB = await createManager('race-inst-b');
            const wsAdmin = createMockWs();
            const ws1 = createMockWs();
            const ws2 = createMockWs();

            await managerA.handleMessage('admin-race', wsAdmin, { type: 'create_session', sessionId: 'race-route' });
            await sleep(300);

            await Promise.all([
                managerB.handleMessage('race-c1', ws1, { type: 'player_join', sessionId: 'race-route', playerId: 'race-1', name: 'Race 1' }),
                managerB.handleMessage('race-c2', ws2, { type: 'player_join', sessionId: 'race-route', playerId: 'race-2', name: 'Race 2' })
            ]);
            await sleep(300);

            assert.strictEqual(managerB.sessions.has('race-route'), true);
            assert.strictEqual(managerB.sessions.size, 2, 'default + race-route uniquement');
            const players = managerB.sessions.get('race-route').store.getPlayers().map(p => p.id).sort();
            assert.deepStrictEqual(players, ['race-1', 'race-2']);
        });
    } else {
        console.log('  ⏭️  Tests Redis recovery/routing ignores : REDIS_URL absent');
    }

    await shutdownManagers();

    const report = {
        startedAt: new Date().toISOString(),
        redisUrl: REDIS_URL,
        passed,
        failed,
        results
    };
    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`\n📄 Rapport JSON : ${REPORT_JSON}`);

    if (failed > 0) {
        console.log(`\n❌ ECHEC TESTS SESSION ROUTING (${passed}/${passed + failed})`);
        process.exit(1);
    }

    console.log(`\n✅ TOUS LES TESTS SESSION ROUTING PASSENT ! (${passed}/${passed + failed})\n`);
}

run().catch(async error => {
    console.error(error.stack || error.message);
    await shutdownManagers();
    process.exit(1);
});
