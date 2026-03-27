#!/usr/bin/env node
/**
 * stress-test.js — Step 6: Multi-client experiment
 *
 * 3-phase stress test designed to fill every Grafana panel:
 *   Phase 1 — Ramp-up:   clients connect gradually        (30s)
 *   Phase 2 — Peak load: all clients clicking, churn       (60s)
 *   Phase 3 — Ramp-down: clients disconnect gradually      (30s)
 *
 * Features:
 *   - Gradual ramp-up/down → nice curves on Connected Players
 *   - Connection churn → fills Connection Events / s
 *   - Low MAX_GAUGE → game ends, rejected clicks visible
 *   - Auto-reset after victory → multiple game cycles
 *   - Round-trip latency tracking → fills Message Latency
 *
 * Usage:
 *   SERVER_URL=wss://clickwars-ws.3sigma-studios.com node stress-test.js
 *   CLIENTS=100 node stress-test.js
 *   CLIENTS=50 RAMP=20 PEAK=40 node stress-test.js
 */

const WebSocket = require('ws');
const C = require('./cli-colors');

// ─── Config ──────────────────────────────────────────────────────
const SERVER_URL  = process.env.SERVER_URL || 'ws://localhost:7777';
const NUM_CLIENTS = parseInt(process.env.CLIENTS || '50');
const RAMP_SEC    = parseInt(process.env.RAMP || '30');
const PEAK_SEC    = parseInt(process.env.PEAK || '60');
const DOWN_SEC    = parseInt(process.env.DOWN || '30');
const CLICK_MS    = parseInt(process.env.CLICK_MS || '50');
const MAX_GAUGE   = parseInt(process.env.MAX_GAUGE || '3000');
const CHURN_PCT   = parseInt(process.env.CHURN || '15'); // % of clients that churn during peak

const TOTAL_SEC = RAMP_SEC + PEAK_SEC + DOWN_SEC;

// ─── Stats ───────────────────────────────────────────────────────
const stats = {
    connectSuccess: 0,
    connectFailed: 0,
    reconnects: 0,
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
    gameEnds: 0,
    gameResets: 0,
    phases: [],
    instances: new Set(),
    peakConnected: 0,
    activeClients: 0,
};

const clients = [];
const pendingClicks = new Map(); // clickId -> timestamp for latency measurement
let clickIdCounter = 0;
let adminWs = null;

// ─── Header ──────────────────────────────────────────────────────
console.log(`${C.bold}${C.cyan}`);
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🔥  STRESS TEST — ClickWars Multi-Client Experiment       ║');
console.log('║  Step 6: 3-Phase Load Test for Grafana Monitoring          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(C.reset);
console.log(`  Server     : ${C.yellow}${SERVER_URL}${C.reset}`);
console.log(`  Clients    : ${C.bold}${NUM_CLIENTS}${C.reset}`);
console.log(`  Phases     : ${C.bold}ramp ${RAMP_SEC}s → peak ${PEAK_SEC}s → down ${DOWN_SEC}s = ${TOTAL_SEC}s total${C.reset}`);
console.log(`  Click rate : ${C.bold}every ${CLICK_MS}ms${C.reset} per client`);
console.log(`  Max gauge  : ${C.bold}${MAX_GAUGE.toLocaleString()}${C.reset} (game will end & restart)`);
console.log(`  Churn      : ${C.bold}${CHURN_PCT}%${C.reset} of clients disconnect/reconnect during peak`);
console.log();

// ─── Connect a single client ─────────────────────────────────────
function connectClient(id, isReconnect = false) {
    return new Promise((resolve) => {
        const team = id % 2 === 0 ? 'A' : 'B';
        const name = `StressBot-${team}${id}`;
        let ws;
        try {
            ws = new WebSocket(SERVER_URL);
        } catch (e) {
            stats.connectFailed++;
            resolve(null);
            return;
        }
        const client = { id, name, team, ws, clicksSent: 0, interval: null, connected: false };

        const timeout = setTimeout(() => {
            if (!client.connected) {
                stats.connectFailed++;
                ws.terminate();
                resolve(null);
            }
        }, 10000);

        ws.on('open', () => {
            client.connected = true;
            stats.connectSuccess++;
            stats.activeClients++;
            if (stats.activeClients > stats.peakConnected) stats.peakConnected = stats.activeClients;
            if (isReconnect) stats.reconnects++;
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

                        // Latency tracking
                        if (msg.clickId && pendingClicks.has(msg.clickId)) {
                            const lat = Date.now() - pendingClicks.get(msg.clickId);
                            stats.latencies.push(lat);
                            pendingClicks.delete(msg.clickId);
                            // Keep map from growing
                            if (pendingClicks.size > 5000) {
                                const oldest = [...pendingClicks.keys()].slice(0, 2000);
                                oldest.forEach(k => pendingClicks.delete(k));
                            }
                        }
                    }

                    if (msg.type === 'victory') {
                        stats.gameEnds++;
                        stats.phases.push({ time: Date.now(), event: 'victory', detail: msg.winner });
                    }

                    if (msg.type === 'lobby_update' || msg.type === 'game_reset') {
                        stats.gameResets++;
                    }
                } catch (e) {}
            });

            resolve(client);
        });

        ws.on('error', () => {
            stats.errors++;
            clearTimeout(timeout);
            if (!client.connected) {
                stats.connectFailed++;
                resolve(null);
            }
        });

        ws.on('close', () => {
            if (client.connected) {
                stats.disconnects++;
                stats.activeClients--;
                client.connected = false;
            }
        });

        clients[id] = client;
    });
}

// ─── Start/stop clicking ─────────────────────────────────────────
function startClicking(client) {
    if (!client || !client.connected || client.ws.readyState !== WebSocket.OPEN) return;
    if (client.interval) return; // already clicking

    client.interval = setInterval(() => {
        if (!client.connected || client.ws.readyState !== WebSocket.OPEN) {
            clearInterval(client.interval);
            client.interval = null;
            return;
        }
        try {
            const clickId = `c${clickIdCounter++}`;
            pendingClicks.set(clickId, Date.now());
            client.ws.send(JSON.stringify({
                type: 'click',
                playerId: `stress_${client.id}`,
                clickId,
                timestamp: Date.now(),
            }));
            client.clicksSent++;
            stats.totalClicksSent++;
        } catch (e) {
            stats.errors++;
        }
    }, CLICK_MS);
}

function stopClicking(client) {
    if (client && client.interval) {
        clearInterval(client.interval);
        client.interval = null;
    }
}

// ─── Disconnect/reconnect a client (churn) ───────────────────────
async function churnClient(id) {
    const client = clients[id];
    if (!client || !client.connected) return;

    stopClicking(client);
    if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000);
    }

    // Wait 2-5 seconds then reconnect
    const delay = 2000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, delay));

    const newClient = await connectClient(id, true);
    if (newClient && newClient.connected) {
        startClicking(newClient);
    }
}

// ─── Auto-reset game after victory ───────────────────────────────
function setupAutoReset(ws) {
    adminWs = ws;
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'victory') {
                stats.phases.push({ time: Date.now(), event: 'auto-reset', detail: 'restarting in 3s' });
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'reset_game' }));
                        setTimeout(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'update_config', maxGauge: MAX_GAUGE }));
                                setTimeout(() => {
                                    if (ws.readyState === WebSocket.OPEN) {
                                        ws.send(JSON.stringify({ type: 'start_game' }));
                                    }
                                }, 500);
                            }
                        }, 500);
                    }
                }, 3000);
            }
        } catch (e) {}
    });
}

// ─── Live progress display ───────────────────────────────────────
function showProgress() {
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
    const remaining = Math.max(0, TOTAL_SEC - elapsed);
    const clicksPerSec = elapsed > 0 ? Math.round(stats.totalClicksSent / elapsed) : 0;

    let phase, phaseColor;
    if (elapsed < RAMP_SEC) {
        phase = 'RAMP-UP';
        phaseColor = C.yellow;
    } else if (elapsed < RAMP_SEC + PEAK_SEC) {
        phase = 'PEAK';
        phaseColor = C.red;
    } else {
        phase = 'RAMP-DOWN';
        phaseColor = C.magenta;
    }

    const barLen = 40;
    const progress = Math.min(elapsed / TOTAL_SEC, 1);
    const filled = Math.round(progress * barLen);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

    const avgLat = stats.latencies.length > 0
        ? Math.round(stats.latencies.slice(-100).reduce((a, b) => a + b, 0) / Math.min(stats.latencies.length, 100))
        : 0;

    process.stdout.write(
        `\r  ${phaseColor}[${phase}]${C.reset} ${C.cyan}[${bar}]${C.reset} ${remaining}s` +
        `  ${C.green}${stats.activeClients} online${C.reset}` +
        `  ${C.blue}${clicksPerSec}/s${C.reset}` +
        `  ${C.yellow}${avgLat}ms lat${C.reset}` +
        `  ${C.magenta}${stats.gameEnds} wins${C.reset}` +
        `  ${C.red}${stats.errors} err${C.reset}  `
    );
}

// ─── Report ──────────────────────────────────────────────────────
function printReport() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const clicksPerSec = Math.round(stats.totalClicksSent / duration);
    const msgsPerSec = Math.round(stats.messagesReceived / duration);

    // Latency stats
    const lats = stats.latencies.sort((a, b) => a - b);
    const avgLat = lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
    const p50 = lats.length > 0 ? lats[Math.floor(lats.length * 0.5)] : 0;
    const p95 = lats.length > 0 ? lats[Math.floor(lats.length * 0.95)] : 0;
    const p99 = lats.length > 0 ? lats[Math.floor(lats.length * 0.99)] : 0;

    console.log(`\n\n${C.bold}${C.cyan}${'='.repeat(62)}${C.reset}`);
    console.log(`${C.bold}  STRESS TEST REPORT${C.reset}`);
    console.log(`${C.cyan}${'='.repeat(62)}${C.reset}\n`);

    // Connection stats
    console.log(`  ${C.bold}Connections${C.reset}`);
    console.log(`    Total connects  : ${stats.connectSuccess}`);
    console.log(`    ${C.green}Peak online   : ${stats.peakConnected}${C.reset}`);
    console.log(`    Reconnects      : ${stats.reconnects}`);
    if (stats.connectFailed > 0) {
        console.log(`    ${C.red}Failed        : ${stats.connectFailed}${C.reset}`);
    }
    console.log(`    Disconnects     : ${stats.disconnects}`);
    console.log(`    Instances hit   : ${[...stats.instances].join(', ') || 'N/A'}`);
    console.log();

    // Click stats
    console.log(`  ${C.bold}Clicks${C.reset}`);
    console.log(`    Total sent      : ${stats.totalClicksSent.toLocaleString()}`);
    console.log(`    ${C.green}Validated     : ${stats.totalClicksValidated.toLocaleString()}${C.reset}`);
    console.log(`    ${C.red}Rejected      : ${stats.totalClicksRejected.toLocaleString()}${C.reset}`);
    const rejPct = stats.totalClicksSent > 0 ? ((stats.totalClicksRejected / stats.totalClicksSent) * 100).toFixed(1) : '0.0';
    console.log(`    Rejection rate  : ${rejPct}%`);
    console.log(`    Throughput      : ${C.bold}${clicksPerSec.toLocaleString()} clicks/sec${C.reset}`);
    console.log();

    // Latency stats
    console.log(`  ${C.bold}Latency${C.reset}`);
    console.log(`    Samples         : ${lats.length.toLocaleString()}`);
    console.log(`    Average         : ${avgLat}ms`);
    console.log(`    p50             : ${p50}ms`);
    console.log(`    p95             : ${p95}ms`);
    console.log(`    p99             : ${p99}ms`);
    console.log();

    // Server stats
    console.log(`  ${C.bold}Server${C.reset}`);
    console.log(`    Messages recv   : ${stats.messagesReceived.toLocaleString()}`);
    console.log(`    Msg throughput  : ${C.bold}${msgsPerSec.toLocaleString()} msg/sec${C.reset}`);
    console.log(`    Final gauge A   : ${stats.lastGaugeA.toLocaleString()}`);
    console.log(`    Final gauge B   : ${stats.lastGaugeB.toLocaleString()}`);
    console.log(`    Game victories  : ${stats.gameEnds}`);
    console.log(`    Duration        : ${duration.toFixed(1)}s`);
    if (stats.errors > 0) {
        console.log(`    ${C.red}Errors        : ${stats.errors}${C.reset}`);
    }
    console.log();

    // Verdict
    console.log(`  ${C.bold}Verdict${C.reset}`);
    if (stats.connectFailed === 0 && stats.errors === 0) {
        console.log(`    ${C.green}${C.bold}+  PASS — Server handled ${stats.peakConnected} concurrent clients with 0 errors${C.reset}`);
    } else if (stats.errors < NUM_CLIENTS * 0.05) {
        console.log(`    ${C.yellow}${C.bold}~  ACCEPTABLE — Minor issues (${stats.errors} errors, ${stats.connectFailed} failed)${C.reset}`);
    } else {
        console.log(`    ${C.red}${C.bold}x  ISSUES — ${stats.errors} errors, ${stats.connectFailed} failed connections${C.reset}`);
    }

    // Game events timeline
    if (stats.phases.length > 0) {
        console.log();
        console.log(`  ${C.bold}Timeline${C.reset}`);
        stats.phases.forEach(p => {
            const t = ((p.time - stats.startTime) / 1000).toFixed(1);
            console.log(`    [${t}s] ${p.event}: ${p.detail || ''}`);
        });
    }

    console.log(`\n${C.cyan}${'='.repeat(62)}${C.reset}\n`);
}

// ─── Main ────────────────────────────────────────────────────────
async function run() {
    stats.startTime = Date.now();

    // ── Phase 1: Ramp-up ──────────────────────────────────────────
    console.log(`  ${C.bold}${C.yellow}Phase 1: Ramp-up — connecting ${NUM_CLIENTS} clients over ${RAMP_SEC}s${C.reset}\n`);

    const delayBetween = (RAMP_SEC * 1000) / NUM_CLIENTS;
    let firstClient = null;

    // Start progress display
    const progressInterval = setInterval(showProgress, 500);

    for (let i = 0; i < NUM_CLIENTS; i++) {
        const client = await connectClient(i);
        if (client && client.connected) {
            if (!firstClient) {
                firstClient = client;
                // Setup admin: config + start game + auto-reset
                client.ws.send(JSON.stringify({ type: 'update_config', maxGauge: MAX_GAUGE }));
                await new Promise(r => setTimeout(r, 300));
                client.ws.send(JSON.stringify({ type: 'start_game' }));
                await new Promise(r => setTimeout(r, 300));
                setupAutoReset(client.ws);
            }
            startClicking(client);
        }

        // Spread connections over ramp period
        if (delayBetween > 10) {
            await new Promise(r => setTimeout(r, delayBetween));
        }
    }

    // ── Phase 2: Peak load with churn ─────────────────────────────
    stats.phases.push({ time: Date.now(), event: 'peak-start', detail: `${stats.activeClients} clients` });

    const churnCount = Math.floor(NUM_CLIENTS * CHURN_PCT / 100);
    const churnInterval = churnCount > 0 ? (PEAK_SEC * 1000) / churnCount : Infinity;

    let churnTimer = null;
    let churnIndex = 0;

    if (churnCount > 0) {
        churnTimer = setInterval(() => {
            // Pick a random client to churn
            const id = Math.floor(Math.random() * NUM_CLIENTS);
            churnClient(id);
            churnIndex++;
            if (churnIndex >= churnCount && churnTimer) {
                clearInterval(churnTimer);
            }
        }, churnInterval);
    }

    // Wait peak duration
    await new Promise(r => setTimeout(r, PEAK_SEC * 1000));

    if (churnTimer) clearInterval(churnTimer);
    stats.phases.push({ time: Date.now(), event: 'peak-end', detail: `${stats.activeClients} clients` });

    // ── Phase 3: Ramp-down ────────────────────────────────────────
    const downDelay = (DOWN_SEC * 1000) / NUM_CLIENTS;

    for (let i = NUM_CLIENTS - 1; i >= 0; i--) {
        const client = clients[i];
        if (client && client.connected) {
            stopClicking(client);
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close(1000);
            }
        }
        if (downDelay > 5) {
            await new Promise(r => setTimeout(r, downDelay));
        }
    }

    // ── Done ──────────────────────────────────────────────────────
    stats.endTime = Date.now();
    clearInterval(progressInterval);

    await new Promise(r => setTimeout(r, 1500));

    printReport();
    setTimeout(() => process.exit(0), 500);
}

run().catch(e => {
    console.error(`${C.red}Fatal error: ${e.message}${C.reset}`);
    process.exit(1);
});

process.on('SIGINT', () => {
    stats.endTime = Date.now() || stats.startTime + 1;
    clients.forEach(c => stopClicking(c));
    printReport();
    process.exit(0);
});
