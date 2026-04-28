#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RateLimiter = require('./RateLimiter');
const SessionManager = require('./SessionManager');

const REPORT_JSON = process.env.REPORT_JSON || path.join(os.tmpdir(), 'clickwars-abuse-latency-edge-report.json');

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
    const manager = new SessionManager({ instanceId });
    await manager.initDefault();
    managers.push(manager);
    return manager;
}

async function shutdownManagers() {
    while (managers.length > 0) {
        await managers.pop().shutdown();
    }
}

async function test(name, fn) {
    const startedAt = Date.now();
    try {
        await fn();
        passed++;
        results.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
        console.log(`  OK ${name}`);
    } catch (error) {
        failed++;
        results.push({ name, status: 'failed', error: error.message, durationMs: Date.now() - startedAt });
        console.log(`  FAIL ${name}`);
        console.log(`     -> ${error.message}`);
    }
}

function assertRejected(decision, code) {
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.code, code);
}

function lastMessage(ws, type) {
    return [...ws.messages].reverse().find(message => message.type === type);
}

async function gatewayHandle(manager, limiter, clientId, ws, message, now = Date.now()) {
    const rawDecision = limiter.checkRaw(clientId, Buffer.byteLength(JSON.stringify(message)), now);
    if (!rawDecision.allowed) {
        sendRateLimited(ws, rawDecision);
        return rawDecision;
    }

    const rateDecision = limiter.checkMessage(clientId, message, now);
    if (!rateDecision.allowed) {
        sendRateLimited(ws, rateDecision);
        return rateDecision;
    }

    await manager.handleMessage(clientId, ws, message);
    return rateDecision;
}

function sendRateLimited(ws, decision) {
    ws.send(JSON.stringify({
        type: 'rate_limited',
        code: decision.code,
        message: decision.message,
        retryAfterMs: decision.retryAfterMs,
        timestamp: Date.now()
    }));
}

async function run() {
    console.log('');
    console.log('============================================================');
    console.log(' ClickWars Abuse, Latency Simulation & Edge Tests');
    console.log('============================================================');
    console.log('');

    await test('Rate limit: payload trop gros rejete explicitement', () => {
        const limiter = new RateLimiter({ maxPayloadBytes: 10 });
        assertRejected(limiter.checkRaw('c1', 11, 1000), 'PAYLOAD_TOO_LARGE');
        assert.strictEqual(limiter.getMetrics().oversizedPayloads, 1);
    });

    await test('Rate limit: trop de messages dans la fenetre', () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxMessages: 2, maxClicks: 100 });
        assert.strictEqual(limiter.checkMessage('c1', { type: 'ping' }, 1000).allowed, true);
        assert.strictEqual(limiter.checkMessage('c1', { type: 'ping' }, 1010).allowed, true);
        assertRejected(limiter.checkMessage('c1', { type: 'ping' }, 1020), 'MESSAGE_RATE_LIMIT');
    });

    await test('Rate limit: trop de clics ne degradent pas les autres clients', () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxMessages: 100, maxClicks: 2 });
        assert.strictEqual(limiter.checkMessage('abuser', { type: 'click', playerId: 'p1' }, 1000).allowed, true);
        assert.strictEqual(limiter.checkMessage('abuser', { type: 'click', playerId: 'p1' }, 1010).allowed, true);
        assertRejected(limiter.checkMessage('abuser', { type: 'click', playerId: 'p1' }, 1020), 'CLICK_RATE_LIMIT');
        assert.strictEqual(limiter.checkMessage('normal', { type: 'click', playerId: 'p2' }, 1020).allowed, true);
    });

    await test('Rate limit: join/session spam bloque par client', () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxMessages: 100, maxJoins: 1 });
        assert.strictEqual(limiter.checkMessage('c1', { type: 'player_join' }, 1000).allowed, true);
        assertRejected(limiter.checkMessage('c1', { type: 'create_session' }, 1010), 'JOIN_RATE_LIMIT');
    });

    await test('Rate limit: JSON invalide mesure et bloque apres seuil', () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxInvalidJson: 1 });
        assert.strictEqual(limiter.checkInvalidJson('c1', 1000).allowed, true);
        assertRejected(limiter.checkInvalidJson('c1', 1010), 'INVALID_JSON_RATE');
        assert.strictEqual(limiter.getMetrics().invalidJson, 2);
    });

    await test('Rate limit: actionId duplique rejete puis expire', () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxMessages: 100, maxClicks: 100, actionIdTtlMs: 100 });
        const click = { type: 'click', playerId: 'p1', actionId: 'same-action' };
        assert.strictEqual(limiter.checkMessage('c1', click, 1000).allowed, true);
        assertRejected(limiter.checkMessage('c1', click, 1010), 'DUPLICATE_ACTION');
        assert.strictEqual(limiter.checkMessage('c1', click, 1200).allowed, true);
    });

    await test('Gateway: action dupliquee ne modifie pas deux fois le score', async () => {
        const manager = await createManager('abuse-gateway');
        const limiter = new RateLimiter({ maxMessages: 100, maxClicks: 100, maxJoins: 10 });
        const ws = createMockWs();

        await gatewayHandle(manager, limiter, 'c1', ws, { type: 'player_join', playerId: 'alice', name: 'Alice' }, 1000);
        await gatewayHandle(manager, limiter, 'c1', ws, { type: 'update_config', maxGauge: 100 }, 1010);
        await gatewayHandle(manager, limiter, 'c1', ws, { type: 'start_game' }, 1020);
        await gatewayHandle(manager, limiter, 'c1', ws, { type: 'click', playerId: 'alice', actionId: 'click-1' }, 1030);
        const duplicate = await gatewayHandle(manager, limiter, 'c1', ws, { type: 'click', playerId: 'alice', actionId: 'click-1' }, 1040);

        const server = manager.sessions.get('default').server;
        assertRejected(duplicate, 'DUPLICATE_ACTION');
        assert.strictEqual(server.store.getGauge('A'), 1);
        assert.strictEqual(server.getPlayer('alice').score, 1);
        assert.strictEqual(lastMessage(ws, 'rate_limited').code, 'DUPLICATE_ACTION');
    });

    await test('Edge: reconnect storm conserve equipes et scores', async () => {
        const manager = await createManager('edge-reconnect-storm');
        const teams = new Map();
        const scores = new Map();

        for (let i = 0; i < 8; i++) {
            const ws = createMockWs();
            await manager.handleMessage(`c${i}`, ws, { type: 'player_join', playerId: `p${i}`, name: `P${i}` });
        }
        await manager.handleMessage('admin', createMockWs(), { type: 'update_config', maxGauge: 1000 });
        await manager.handleMessage('admin', createMockWs(), { type: 'start_game' });
        for (let i = 0; i < 8; i++) {
            await manager.handleMessage(`c${i}`, createMockWs(), { type: 'click', playerId: `p${i}` });
            const player = manager.sessions.get('default').server.getPlayer(`p${i}`);
            teams.set(`p${i}`, player.team);
            scores.set(`p${i}`, player.score);
            manager.removeClient(`c${i}`);
        }

        await Promise.all([...teams.keys()].map((playerId, index) =>
            manager.handleMessage(`reco${index}`, createMockWs(), { type: 'player_join', playerId, name: playerId })
        ));

        for (const [playerId, team] of teams.entries()) {
            const player = manager.sessions.get('default').server.getPlayer(playerId);
            assert.strictEqual(player.team, team);
            assert.strictEqual(player.score, scores.get(playerId));
            assert.strictEqual(player.isDisconnected, false);
        }
    });

    await test('Edge: leave/rejoin autour de victory garde la session coherente', async () => {
        const manager = await createManager('edge-victory-rejoin');
        const wsAlice = createMockWs();
        const wsBob = createMockWs();

        await manager.handleMessage('alice-c', wsAlice, { type: 'player_join', playerId: 'alice', name: 'Alice' });
        await manager.handleMessage('bob-c', wsBob, { type: 'player_join', playerId: 'bob', name: 'Bob' });
        await manager.handleMessage('admin', createMockWs(), { type: 'update_config', maxGauge: 10 });
        await manager.handleMessage('admin', createMockWs(), { type: 'start_game' });
        manager.removeClient('bob-c');
        for (let i = 0; i < 10; i++) {
            await manager.handleMessage('alice-c', wsAlice, { type: 'click', playerId: 'alice' });
        }

        const server = manager.sessions.get('default').server;
        assert.strictEqual(server.store.getPhase(), 'victory');
        assert.strictEqual(server.store.getWinner(), 'A');

        await manager.handleMessage('bob-reco', wsBob, { type: 'player_join', playerId: 'bob', name: 'Bob' });
        assert.strictEqual(lastMessage(wsBob, 'session_joined').restored, true);
        assert.strictEqual(server.getPlayer('bob').isDisconnected, false);
        assert.strictEqual(server.store.getPhase(), 'victory');
    });

    await shutdownManagers();

    const report = {
        startedAt: new Date().toISOString(),
        passed,
        failed,
        results
    };
    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`\nReport JSON: ${REPORT_JSON}`);

    if (failed > 0) {
        console.log(`\nFAILED ABUSE/LATENCY/EDGE TESTS (${passed}/${passed + failed})`);
        process.exit(1);
    }

    console.log(`\nALL ABUSE/LATENCY/EDGE TESTS PASSED (${passed}/${passed + failed})\n`);
}

run().catch(async error => {
    console.error(error.stack || error.message);
    await shutdownManagers();
    process.exit(1);
});
