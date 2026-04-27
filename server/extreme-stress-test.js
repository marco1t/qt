#!/usr/bin/env node

/**
 * extreme-stress-test.js
 *
 * Multi-instance stress harness for ClickWars.
 *
 * It intentionally generates high traffic, reconnect storms, and high-frequency
 * gameplay actions while checking broadcast metadata for duplicates, sequence
 * gaps, and durable state divergence between clients.
 *
 * Usage:
 *   SERVER_URLS=ws://localhost:7777,ws://localhost:7778 PROFILE=smoke node extreme-stress-test.js
 *   PROFILE=aggressive CLIENTS=800 WORKERS=8 CLICK_HZ=30 node extreme-stress-test.js
 *   PROFILE=overload REPORT_JSON=./report.json node extreme-stress-test.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const PROFILES = {
    smoke: {
        clients: 50,
        workers: 2,
        rampSec: 5,
        peakSec: 20,
        downSec: 5,
        clickHz: 5,
        burstSize: 1,
        reconnectPct: 10,
        reconnectStorms: 2,
        maxGauge: 100000
    },
    aggressive: {
        clients: 500,
        workers: Math.min(8, Math.max(2, os.cpus().length)),
        rampSec: 20,
        peakSec: 80,
        downSec: 20,
        clickHz: 20,
        burstSize: 1,
        reconnectPct: 15,
        reconnectStorms: 4,
        maxGauge: 1000000
    },
    overload: {
        clients: 1500,
        workers: Math.min(12, Math.max(4, os.cpus().length)),
        rampSec: 30,
        peakSec: 120,
        downSec: 30,
        clickHz: 50,
        burstSize: 1,
        reconnectPct: 25,
        reconnectStorms: 6,
        maxGauge: 5000000
    }
};

function envInt(name, fallback) {
    const value = process.env[name];
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIsoSafe() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function sumStats(values) {
    const total = {};
    for (const value of values) {
        for (const [key, entry] of Object.entries(value || {})) {
            if (typeof entry === 'number') {
                total[key] = (total[key] || 0) + entry;
            }
        }
    }
    return total;
}

function httpGet(url, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const mod = url.startsWith('https:') ? https : http;
        const req = mod.get(url, { timeout: timeoutMs }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({ url, statusCode: res.statusCode, body }));
        });
        req.on('timeout', () => {
            req.destroy(new Error('timeout'));
        });
        req.on('error', error => resolve({ url, error: error.message }));
    });
}

function isOpen(ws) {
    return ws && ws.readyState === WebSocket.OPEN;
}

function sendJson(ws, payload) {
    if (!isOpen(ws)) return false;
    ws.send(JSON.stringify({ ...payload, timestamp: payload.timestamp || Date.now() }));
    return true;
}

function parseJson(data) {
    return JSON.parse(data.toString());
}

function isStateCarrier(msg) {
    return msg.type === 'state_update' || msg.type === 'lobby_update' || msg.type === 'victory';
}

function isPhaseCarrier(msg) {
    return msg.type === 'state_update' || msg.type === 'lobby_update';
}

function pickConfig() {
    const profileName = (process.env.PROFILE || 'smoke').toLowerCase();
    const base = PROFILES[profileName] || PROFILES.smoke;
    const serverUrls = (process.env.SERVER_URLS || 'ws://localhost:7777,ws://localhost:7778')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    return {
        profile: profileName,
        serverUrls,
        metricsUrls: (process.env.METRICS_URLS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        clients: envInt('CLIENTS', base.clients),
        workers: envInt('WORKERS', base.workers),
        rampSec: envInt('RAMP_SEC', base.rampSec),
        peakSec: envInt('PEAK_SEC', base.peakSec),
        downSec: envInt('DOWN_SEC', base.downSec),
        clickHz: envInt('CLICK_HZ', base.clickHz),
        burstSize: envInt('BURST_SIZE', base.burstSize),
        reconnectPct: envInt('RECONNECT_PCT', base.reconnectPct),
        reconnectStorms: envInt('RECONNECT_STORMS', base.reconnectStorms),
        maxGauge: envInt('MAX_GAUGE', base.maxGauge),
        sessionId: process.env.SESSION_ID || 'default',
        reportJson: process.env.REPORT_JSON || path.join(__dirname, `extreme-stress-report-${nowIsoSafe()}.json`),
        sampleMs: envInt('SAMPLE_MS', 1000),
        stableWindowMs: envInt('STABLE_WINDOW_MS', 2000)
    };
}

if (!isMainThread) {
    runWorker(workerData);
} else {
    runMain().catch(error => {
        console.error(`[fatal] ${error.stack || error.message}`);
        process.exit(1);
    });
}

async function runMain() {
    const config = pickConfig();
    const startedAt = Date.now();
    const totalSec = config.rampSec + config.peakSec + config.downSec;
    const workers = [];
    const latestByWorker = new Map();
    const workerStats = new Map();
    const divergenceSamples = [];
    const durableDivergenceSamples = [];
    let consecutiveDivergenceSamples = 0;

    console.log('');
    console.log('============================================================');
    console.log(' ClickWars Extreme Stress Test');
    console.log('============================================================');
    console.log(` Profile      : ${config.profile}`);
    console.log(` Servers      : ${config.serverUrls.join(', ')}`);
    console.log(` Clients      : ${config.clients}`);
    console.log(` Workers      : ${config.workers}`);
    console.log(` Phases       : ramp ${config.rampSec}s, peak ${config.peakSec}s, down ${config.downSec}s`);
    console.log(` Click load   : ${config.clickHz}Hz x burst ${config.burstSize} per client`);
    console.log(` Reconnects   : ${config.reconnectStorms} storms, ${config.reconnectPct}% clients/storm`);
    console.log(` Session      : ${config.sessionId}`);
    console.log(` Report JSON  : ${config.reportJson}`);
    console.log('');

    const admin = await openAdmin(config.serverUrls[0], config);
    if (config.sessionId !== 'default') {
        sendJson(admin, { type: 'create_session', sessionId: config.sessionId });
        await sleep(250);
    }
    sendJson(admin, { type: 'update_config', sessionId: config.sessionId, maxGauge: config.maxGauge });
    await sleep(250);
    sendJson(admin, { type: 'reset_game', sessionId: config.sessionId });
    await sleep(250);
    sendJson(admin, { type: 'update_config', sessionId: config.sessionId, maxGauge: config.maxGauge });
    await sleep(250);
    sendJson(admin, { type: 'start_game', sessionId: config.sessionId });

    const baseClientsPerWorker = Math.floor(config.clients / config.workers);
    let remainder = config.clients % config.workers;
    let nextClientId = 0;

    for (let i = 0; i < config.workers; i++) {
        const clientCount = baseClientsPerWorker + (remainder-- > 0 ? 1 : 0);
        const worker = new Worker(__filename, {
            workerData: {
                workerId: i,
                clientStart: nextClientId,
                clientCount,
                config
            }
        });
        nextClientId += clientCount;

        worker.on('message', message => {
            if (message.type === 'stats') {
                workerStats.set(i, message.stats);
                latestByWorker.set(i, message.latestStates || []);
            }
            if (message.type === 'log') {
                console.log(`[worker:${i}] ${message.message}`);
            }
        });
        worker.on('error', error => {
            workerStats.set(i, {
                ...(workerStats.get(i) || {}),
                workerErrors: ((workerStats.get(i) || {}).workerErrors || 0) + 1
            });
            console.error(`[worker:${i}] ${error.message}`);
        });
        worker.on('exit', code => {
            if (code !== 0) {
                const current = workerStats.get(i) || {};
                current.workerErrors = (current.workerErrors || 0) + 1;
                workerStats.set(i, current);
            }
        });
        workers.push(worker);
    }

    const sampleTimer = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        const stats = sumStats([...workerStats.values()]);
        const sample = sampleConsistency([...latestByWorker.values()].flat(), config);
        if (sample.consideredClients > 1) {
            divergenceSamples.push(sample);
            if (sample.diverged) {
                consecutiveDivergenceSamples++;
                if (consecutiveDivergenceSamples >= 2) {
                    durableDivergenceSamples.push({
                        ...sample,
                        consecutiveSamples: consecutiveDivergenceSamples
                    });
                }
            } else {
                consecutiveDivergenceSamples = 0;
            }
        }

        process.stdout.write(
            `\r[t+${String(elapsed).padStart(3)}s/${totalSec}s] ` +
            `online=${stats.connected || 0} clicks=${stats.clicksSent || 0} ` +
            `msg=${stats.messagesReceived || 0} reco=${stats.reconnects || 0} ` +
            `dup=${stats.duplicateMessages || 0} gaps=${stats.sequenceGaps || 0} ` +
            `div=${sample.diverged ? 'yes' : 'no '}   `
        );
    }, config.sampleMs);

    const rampDelayMs = config.clients > 0 ? (config.rampSec * 1000) / config.clients : 0;
    workers.forEach(worker => worker.postMessage({ type: 'start', rampDelayMs }));

    await sleep(config.rampSec * 1000);

    for (let storm = 0; storm < config.reconnectStorms; storm++) {
        const offset = Math.round(((storm + 1) * config.peakSec * 1000) / (config.reconnectStorms + 1));
        setTimeout(() => {
            workers.forEach(worker => worker.postMessage({ type: 'reconnect_storm' }));
        }, offset);
    }

    await sleep(config.peakSec * 1000);
    workers.forEach(worker => worker.postMessage({ type: 'stop_clicks' }));
    await sleep(config.downSec * 1000);
    workers.forEach(worker => worker.postMessage({ type: 'shutdown' }));

    await Promise.all(workers.map(worker => new Promise(resolve => worker.once('exit', resolve))));
    clearInterval(sampleTimer);
    if (admin.readyState === WebSocket.OPEN) admin.close(1000);

    const endedAt = Date.now();
    const stats = sumStats([...workerStats.values()]);
    const finalConsistency = sampleConsistency([...latestByWorker.values()].flat(), config);
    const metrics = await Promise.all(config.metricsUrls.map(url => httpGet(url)));

    const report = {
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
        config,
        stats,
        consistency: {
            duplicateMessages: stats.duplicateMessages || 0,
            sequenceGaps: stats.sequenceGaps || 0,
            divergenceSamples: divergenceSamples.length,
            durableDivergences: durableDivergenceSamples.length,
            durableDivergenceSamples,
            final: finalConsistency
        },
        workerStats: Object.fromEntries([...workerStats.entries()].map(([id, value]) => [String(id), value])),
        metrics
    };

    fs.writeFileSync(config.reportJson, JSON.stringify(report, null, 2));

    console.log('\n');
    console.log('============================================================');
    console.log(' Extreme Stress Report');
    console.log('============================================================');
    console.log(` Connections ok      : ${stats.connectSuccess || 0}`);
    console.log(` Connection failures : ${stats.connectFailed || 0}`);
    console.log(` Peak connected      : ${stats.peakConnected || 0}`);
    console.log(` Clicks sent         : ${(stats.clicksSent || 0).toLocaleString()}`);
    console.log(` Messages received   : ${(stats.messagesReceived || 0).toLocaleString()}`);
    console.log(` Reconnects          : ${stats.reconnects || 0}`);
    console.log(` Duplicate messages  : ${stats.duplicateMessages || 0}`);
    console.log(` Sequence gaps       : ${stats.sequenceGaps || 0}`);
    console.log(` Durable divergence  : ${durableDivergenceSamples.length}`);
    console.log(` Victories observed  : ${stats.victories || 0}`);
    console.log(` Report              : ${config.reportJson}`);
    console.log('============================================================');

    if ((stats.workerErrors || 0) > 0) process.exitCode = 1;
}

function sampleConsistency(states, config) {
    const cutoff = Date.now() - config.stableWindowMs;
    const recent = states.filter(state => state && state.timestamp >= cutoff && state.stateHash);
    const hashes = new Map();
    for (const state of recent) {
        hashes.set(state.stateHash, (hashes.get(state.stateHash) || 0) + 1);
    }

    return {
        timestamp: Date.now(),
        consideredClients: recent.length,
        hashCount: hashes.size,
        hashes: Object.fromEntries(hashes),
        diverged: hashes.size > 1
    };
}

function openAdmin(url, config) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error(`admin connect timeout: ${url}`));
        }, 10000);
        ws.once('open', () => {
            clearTimeout(timeout);
            resolve(ws);
        });
        ws.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });
        ws.on('message', data => {
            try {
                const msg = parseJson(data);
                if (msg.type === 'victory') {
                    setTimeout(() => {
                        if (!sendJson(ws, { type: 'reset_game', sessionId: config.sessionId })) return;
                        setTimeout(() => {
                            sendJson(ws, { type: 'start_game', sessionId: config.sessionId });
                        }, 250);
                    }, 500);
                }
            } catch (_e) {
                // ignore malformed messages during stress
            }
        });
    });
}

function runWorker(data) {
    const { workerId, clientStart, clientCount, config } = data;
    const clients = [];
    const stats = {
        connectSuccess: 0,
        connectFailed: 0,
        connected: 0,
        peakConnected: 0,
        disconnects: 0,
        reconnects: 0,
        intentionalReconnects: 0,
        clicksSent: 0,
        messagesReceived: 0,
        duplicateMessages: 0,
        sequenceGaps: 0,
        errors: 0,
        victories: 0
    };

    let statsTimer = null;

    parentPort.on('message', async message => {
        if (message.type === 'start') {
            statsTimer = setInterval(reportStats, config.sampleMs);
            if (statsTimer.unref) statsTimer.unref();
            await startClients(message.rampDelayMs);
        }
        if (message.type === 'reconnect_storm') {
            reconnectStorm();
        }
        if (message.type === 'stop_clicks') {
            clients.forEach(stopClicking);
        }
        if (message.type === 'shutdown') {
            await shutdown();
        }
    });

    async function startClients(rampDelayMs) {
        for (let i = 0; i < clientCount; i++) {
            const globalId = clientStart + i;
            const client = createClient(globalId);
            clients.push(client);
            connectClient(client, false);
            if (rampDelayMs > 5) await sleep(rampDelayMs);
        }
    }

    function createClient(globalId) {
        const url = config.serverUrls[globalId % config.serverUrls.length];
        return {
            id: globalId,
            name: `Extreme-${workerId}-${globalId}`,
            playerId: `extreme_${globalId}`,
            url,
            ws: null,
            connected: false,
            playing: false,
            clickTimer: null,
            seenMessageIds: new Set(),
            seqByInstance: new Map(),
            latestState: null
        };
    }

    function connectClient(client, isReconnect) {
        let ws;
        try {
            ws = new WebSocket(client.url, { perMessageDeflate: false });
        } catch (_e) {
            stats.connectFailed++;
            return;
        }

        client.ws = ws;
        client.seqByInstance.clear();

        const timeout = setTimeout(() => {
            if (!client.connected) {
                stats.connectFailed++;
                safeTerminate(ws);
            }
        }, 10000);

        ws.on('open', () => {
            clearTimeout(timeout);
            client.connected = true;
            stats.connected++;
            stats.connectSuccess++;
            if (isReconnect) stats.reconnects++;
            if (stats.connected > stats.peakConnected) stats.peakConnected = stats.connected;
            sendJoin(client);
        });

        ws.on('message', data => {
            stats.messagesReceived++;
            handleMessage(client, data);
        });

        ws.on('close', () => {
            if (client.connected) {
                stats.connected--;
                stats.disconnects++;
            }
            client.connected = false;
            client.playing = false;
            stopClicking(client);
        });

        ws.on('error', () => {
            stats.errors++;
        });
    }

    function handleMessage(client, data) {
        let msg;
        try {
            msg = parseJson(data);
        } catch (_e) {
            stats.errors++;
            return;
        }

        trackBroadcastMetadata(client, msg);
        recordLatestState(client, msg);
        syncGameplayPhase(client, msg);
        handleVictory(client, msg);
    }

    function sendJoin(client) {
        sendJson(client.ws, {
            type: 'player_join',
            sessionId: config.sessionId,
            playerId: client.playerId,
            name: client.name
        });
    }

    function trackBroadcastMetadata(client, msg) {
        if (msg.messageId) {
            if (client.seenMessageIds.has(msg.messageId)) {
                stats.duplicateMessages++;
            } else {
                client.seenMessageIds.add(msg.messageId);
                if (client.seenMessageIds.size > 5000) {
                    client.seenMessageIds.clear();
                }
            }
        }

        if (msg.instanceId && msg.broadcastSeq) {
            const prev = client.seqByInstance.get(msg.instanceId);
            if (prev && msg.broadcastSeq > prev + 1) {
                stats.sequenceGaps += msg.broadcastSeq - prev - 1;
            }
            if (!prev || msg.broadcastSeq > prev) {
                client.seqByInstance.set(msg.instanceId, msg.broadcastSeq);
            }
        }
    }

    function recordLatestState(client, msg) {
        if (!isStateCarrier(msg) || !msg.stateHash) return;
        client.latestState = {
            clientId: client.id,
            serverUrl: client.url,
            sessionId: msg.sessionId,
            type: msg.type,
            phase: msg.phase || (msg.type === 'victory' ? 'victory' : undefined),
            winner: msg.winner,
            teamAGauge: msg.teamAGauge,
            teamBGauge: msg.teamBGauge,
            stateHash: msg.stateHash,
            timestamp: Date.now()
        };
    }

    function syncGameplayPhase(client, msg) {
        if (!isPhaseCarrier(msg)) return;
        if (msg.phase === 'playing' && !client.playing) {
            client.playing = true;
            startClicking(client);
        }
        if (msg.phase !== 'playing' && client.playing) {
            client.playing = false;
            stopClicking(client);
        }
    }

    function handleVictory(client, msg) {
        if (msg.type !== 'victory') return;
        stats.victories++;
        client.playing = false;
        stopClicking(client);
    }

    function startClicking(client) {
        if (client.clickTimer || !client.connected || !isOpen(client.ws)) return;
        const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, config.clickHz)));
        client.clickTimer = setInterval(() => {
            if (!client.connected || !isOpen(client.ws)) {
                stopClicking(client);
                return;
            }
            for (let i = 0; i < config.burstSize; i++) {
                try {
                    sendJson(client.ws, {
                        type: 'click',
                        sessionId: config.sessionId,
                        playerId: client.playerId
                    });
                    stats.clicksSent++;
                } catch (_e) {
                    stats.errors++;
                }
            }
        }, intervalMs);
        if (client.clickTimer.unref) client.clickTimer.unref();
    }

    function stopClicking(client) {
        if (client.clickTimer) {
            clearInterval(client.clickTimer);
            client.clickTimer = null;
        }
    }

    function reconnectStorm() {
        const connected = clients.filter(isConnectedClient);
        const count = Math.max(1, Math.ceil(connected.length * config.reconnectPct / 100));
        shuffle(connected).slice(0, count).forEach((client, index) => {
            stats.intentionalReconnects++;
            disconnectForReconnect(client, index % 2 === 0);
            const delay = 250 + Math.floor(Math.random() * 1250);
            setTimeout(() => connectClient(client, true), delay);
        });
    }

    function isConnectedClient(client) {
        return client.connected && isOpen(client.ws);
    }

    function disconnectForReconnect(client, abrupt) {
        stopClicking(client);
        if (abrupt) {
            safeTerminate(client.ws);
        } else if (isOpen(client.ws)) {
            client.ws.close(1000);
        }
    }

    function reportStats() {
        parentPort.postMessage({
            type: 'stats',
            stats: { ...stats },
            latestStates: clients
                .filter(client => client.latestState)
                .map(client => client.latestState)
        });
    }

    async function shutdown() {
        if (statsTimer) clearInterval(statsTimer);
        clients.forEach(client => {
            disconnectForReconnect(client, !isOpen(client.ws));
        });
        await sleep(500);
        reportStats();
        process.exit(0);
    }
}

function safeTerminate(ws) {
    try {
        if (ws) ws.terminate();
    } catch (_e) {
        // ignore shutdown races during stress
    }
}

function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
