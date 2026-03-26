#!/usr/bin/env node
/**
 * stress-test.js — Step 6: Multi-client experiment
 *
 * Simulates many concurrent WebSocket clients to stress-test the server.
 * Each client connects, joins a team, clicks rapidly, and reports results.
 *
 * Usage:
 *   SERVER_URL=wss://clickwars-ws.3sigma-studios.com node stress-test.js
 *   CLIENTS=100 node stress-test.js              # local, 100 clients
 *   CLIENTS=50 DURATION=30 node stress-test.js    # 50 clients, 30 seconds
 */

const WebSocket = require('ws');

// ─── Config ──────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:7777';
const NUM_CLIENTS = parseInt(process.env.CLIENTS || '50');
const DURATION_SEC = parseInt(process.env.DURATION || '20');
const CLICK_INTERVAL = parseInt(process.env.CLICK_MS || '50'); // ms between clicks per client
const MAX_GAUGE = parseInt(process.env.MAX_GAUGE || '999999'); // high so game doesn't end during test

const C = require('./cli-colors');

// ─── Stats ───────────────────────────────────────────────────────
const stats = {
    connectSuccess: 0,
    connectFailed: 0,
    totalClicksSent: 0,
    totalClicksValidated: 0,
    totalClicksRejected: 0,
    errors: 0,
    disconnects: 0,
    latencies: [],
    messagesReceived: 0,
    startTime: 0,
    endTime: 0,
    lastGaugeA: 0,
    lastGaugeB: 0,
    phases: [],      // track phase changes
    instances: new Set(),
};

const clients = [];

// ─── Header ──────────────────────────────────────────────────────
console.log(`${C.bold}${C.cyan}`);
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🔥  STRESS TEST — ClickWars Multi-Client Experiment       ║');
console.log('║  Step 6: Identify early limitations under load             ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(C.reset);
console.log(`  Server    : ${C.yellow}${SERVER_URL}${C.reset}`);
console.log(`  Clients   : ${C.bold}${NUM_CLIENTS}${C.reset}`);
console.log(`  Duration  : ${C.bold}${DURATION_SEC}s${C.reset}`);
console.log(`  Click rate: ${C.bold}every ${CLICK_INTERVAL}ms${C.reset} per client`);
console.log(`  Max clicks: ~${Math.round(NUM_CLIENTS * (1000/CLICK_INTERVAL) * DURATION_SEC).toLocaleString()} total`);
console.log();

// ─── Connect a single client ─────────────────────────────────────
function connectClient(id) {
    return new Promise((resolve) => {
        const team = id % 2 === 0 ? 'A' : 'B';
        const name = `StressBot-${team}${id}`;
        const ws = new WebSocket(SERVER_URL);
        const client = { id, name, team, ws, clicksSent: 0, interval: null, connected: false };

        const timeout = setTimeout(() => {
            if (!client.connected) {
                stats.connectFailed++;
                ws.terminate();
                resolve(client);
            }
        }, 10000);

        ws.on('open', () => {
            client.connected = true;
            stats.connectSuccess++;
            clearTimeout(timeout);

            // Join as player
            ws.send(JSON.stringify({ type: 'player_join', playerId: `stress_${id}`, name }));

            ws.on('message', (data) => {
                stats.messagesReceived++;
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'state_update') {
                        stats.lastGaugeA = msg.teamAGauge || 0;
                        stats.lastGaugeB = msg.teamBGauge || 0;
                        if (msg.instanceId) stats.instances.add(msg.instanceId.slice(0, 8));
                    }
                    if (msg.type === 'click_result') {
                        if (msg.valid) stats.totalClicksValidated++;
                        else stats.totalClicksRejected++;
                    }
                    if (msg.type === 'victory') {
                        stats.phases.push({ time: Date.now(), event: 'victory', winner: msg.winner });
                    }
                } catch (e) {}
            });

            resolve(client);
        });

        ws.on('error', (e) => {
            stats.errors++;
            clearTimeout(timeout);
            if (!client.connected) {
                stats.connectFailed++;
                resolve(client);
            }
        });

        ws.on('close', (code) => {
            if (client.connected) {
                stats.disconnects++;
            }
        });

        clients.push(client);
    });
}

// ─── Start clicking for a client ─────────────────────────────────
function startClicking(client) {
    if (!client.connected || !client.ws || client.ws.readyState !== WebSocket.OPEN) return;

    client.interval = setInterval(() => {
        if (client.ws.readyState !== WebSocket.OPEN) {
            clearInterval(client.interval);
            return;
        }
        try {
            const ts = Date.now();
            client.ws.send(JSON.stringify({
                type: 'click',
                playerId: `stress_${client.id}`,
                timestamp: ts,
            }));
            client.clicksSent++;
            stats.totalClicksSent++;
        } catch (e) {
            stats.errors++;
        }
    }, CLICK_INTERVAL);
}

// ─── Live progress display ───────────────────────────────────────
function showProgress(elapsed) {
    const remaining = Math.max(0, DURATION_SEC - elapsed);
    const clicksPerSec = elapsed > 0 ? Math.round(stats.totalClicksSent / elapsed) : 0;
    const msgsPerSec = elapsed > 0 ? Math.round(stats.messagesReceived / elapsed) : 0;
    const barLen = 30;
    const progress = Math.min(elapsed / DURATION_SEC, 1);
    const filled = Math.round(progress * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    process.stdout.write(
        `\r  ${C.cyan}[${bar}]${C.reset} ${remaining}s left` +
        `  ${C.green}${stats.connectSuccess} connected${C.reset}` +
        `  ${C.blue}${stats.totalClicksSent.toLocaleString()} clicks${C.reset}` +
        `  ${C.yellow}${clicksPerSec}/s sent${C.reset}` +
        `  ${C.magenta}${msgsPerSec}/s recv${C.reset}` +
        `  ${C.red}${stats.errors} err${C.reset}  `
    );
}

// ─── Report ──────────────────────────────────────────────────────
function printReport() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const clicksPerSec = Math.round(stats.totalClicksSent / duration);
    const msgsPerSec = Math.round(stats.messagesReceived / duration);

    console.log(`\n\n${C.bold}${C.cyan}${'═'.repeat(62)}${C.reset}`);
    console.log(`${C.bold}  STRESS TEST REPORT${C.reset}`);
    console.log(`${C.cyan}${'═'.repeat(62)}${C.reset}\n`);

    // Connection stats
    console.log(`  ${C.bold}Connections${C.reset}`);
    console.log(`    Attempted     : ${NUM_CLIENTS}`);
    console.log(`    ${C.green}Successful  : ${stats.connectSuccess}${C.reset}`);
    if (stats.connectFailed > 0) {
        console.log(`    ${C.red}Failed      : ${stats.connectFailed}${C.reset}`);
    } else {
        console.log(`    Failed      : ${stats.connectFailed}`);
    }
    console.log(`    Disconnected  : ${stats.disconnects}`);
    console.log(`    Instances hit : ${[...stats.instances].join(', ') || 'N/A'}`);
    console.log();

    // Click stats
    console.log(`  ${C.bold}Clicks${C.reset}`);
    console.log(`    Total sent    : ${stats.totalClicksSent.toLocaleString()}`);
    console.log(`    ${C.green}Validated   : ${stats.totalClicksValidated.toLocaleString()}${C.reset}`);
    console.log(`    ${C.red}Rejected    : ${stats.totalClicksRejected.toLocaleString()}${C.reset}`);
    console.log(`    Throughput    : ${C.bold}${clicksPerSec.toLocaleString()} clicks/sec${C.reset}`);
    console.log();

    // Server stats
    console.log(`  ${C.bold}Server${C.reset}`);
    console.log(`    Messages recv : ${stats.messagesReceived.toLocaleString()}`);
    console.log(`    Msg throughput: ${C.bold}${msgsPerSec.toLocaleString()} msg/sec${C.reset}`);
    console.log(`    Final gauge A : ${stats.lastGaugeA.toLocaleString()}`);
    console.log(`    Final gauge B : ${stats.lastGaugeB.toLocaleString()}`);
    console.log(`    Duration      : ${duration.toFixed(1)}s`);
    if (stats.errors > 0) {
        console.log(`    ${C.red}Errors      : ${stats.errors}${C.reset}`);
    }
    console.log();

    // Consistency check
    console.log(`  ${C.bold}Consistency${C.reset}`);
    const totalGauge = stats.lastGaugeA + stats.lastGaugeB;
    if (totalGauge > 0) {
        console.log(`    Total gauge (A+B)    : ${totalGauge.toLocaleString()}`);
        console.log(`    Total clicks sent    : ${stats.totalClicksSent.toLocaleString()}`);
        if (stats.totalClicksRejected > 0) {
            console.log(`    Rejected clicks      : ${stats.totalClicksRejected.toLocaleString()}`);
        }
    }
    if (stats.disconnects === 0 && stats.connectFailed === 0 && stats.errors === 0) {
        console.log(`    ${C.green}${C.bold}✓ No connection issues detected${C.reset}`);
    } else {
        console.log(`    ${C.yellow}⚠ Some issues detected (see above)${C.reset}`);
    }

    // Phase changes
    if (stats.phases.length > 0) {
        console.log();
        console.log(`  ${C.bold}Game Events${C.reset}`);
        stats.phases.forEach(p => {
            const t = ((p.time - stats.startTime) / 1000).toFixed(1);
            console.log(`    [${t}s] ${p.event}: ${p.winner || ''}`);
        });
    }

    console.log(`\n${C.cyan}${'═'.repeat(62)}${C.reset}\n`);
}

// ─── Main ────────────────────────────────────────────────────────
async function run() {
    // Phase 1: Connect all clients in waves
    console.log(`  ${C.bold}Phase 1: Connecting ${NUM_CLIENTS} clients...${C.reset}\n`);

    const WAVE_SIZE = 10; // connect 10 at a time
    for (let i = 0; i < NUM_CLIENTS; i += WAVE_SIZE) {
        const wave = [];
        const end = Math.min(i + WAVE_SIZE, NUM_CLIENTS);
        for (let j = i; j < end; j++) {
            wave.push(connectClient(j));
        }
        await Promise.all(wave);

        const pct = Math.round((end / NUM_CLIENTS) * 100);
        process.stdout.write(`\r  ${C.green}Connected: ${stats.connectSuccess}/${NUM_CLIENTS} (${pct}%)${C.reset}  `);

        // Small delay between waves to avoid overwhelming
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n\n  ${C.green}${C.bold}✓ ${stats.connectSuccess} clients connected${C.reset}`);
    if (stats.connectFailed > 0) {
        console.log(`  ${C.red}✗ ${stats.connectFailed} clients failed to connect${C.reset}`);
    }
    console.log();

    // Setup: Set high max gauge and start game via first connected client
    const adminClient = clients.find(c => c.connected);
    if (!adminClient) {
        console.log(`${C.red}No clients connected. Aborting.${C.reset}`);
        process.exit(1);
    }

    adminClient.ws.send(JSON.stringify({ type: 'update_config', maxGauge: MAX_GAUGE }));
    await new Promise(r => setTimeout(r, 200));
    adminClient.ws.send(JSON.stringify({ type: 'start_game' }));
    await new Promise(r => setTimeout(r, 500));

    // Phase 2: Start clicking
    console.log(`  ${C.bold}Phase 2: Clicking for ${DURATION_SEC}s...${C.reset}\n`);
    stats.startTime = Date.now();

    clients.forEach(c => startClicking(c));

    // Live progress
    const progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
        showProgress(elapsed);
    }, 500);

    // Wait for duration
    await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

    // Phase 3: Stop and report
    stats.endTime = Date.now();
    clearInterval(progressInterval);

    // Stop all clickers
    clients.forEach(c => {
        if (c.interval) clearInterval(c.interval);
    });

    // Wait a moment for final messages
    await new Promise(r => setTimeout(r, 1000));

    printReport();

    // Close all connections
    clients.forEach(c => {
        if (c.ws && c.ws.readyState === WebSocket.OPEN) {
            c.ws.close(1000);
        }
    });

    // Reset game
    if (adminClient.ws.readyState === WebSocket.OPEN) {
        adminClient.ws.send(JSON.stringify({ type: 'reset_game' }));
    }

    setTimeout(() => process.exit(0), 1000);
}

run().catch(e => {
    console.error(`${C.red}Fatal error: ${e.message}${C.reset}`);
    process.exit(1);
});

process.on('SIGINT', () => {
    stats.endTime = Date.now();
    clients.forEach(c => { if (c.interval) clearInterval(c.interval); });
    printReport();
    process.exit(0);
});
