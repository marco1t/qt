class RateLimiter {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.windowMs = positiveInt(options.windowMs, 1000);
        this.maxMessages = positiveInt(options.maxMessages, 120);
        this.maxClicks = positiveInt(options.maxClicks, 80);
        this.maxJoins = positiveInt(options.maxJoins, 5);
        this.maxInvalidJson = positiveInt(options.maxInvalidJson, 10);
        this.maxPayloadBytes = positiveInt(options.maxPayloadBytes, 4096);
        this.actionIdTtlMs = positiveInt(options.actionIdTtlMs, 30000);
        this.closeOnAbuse = options.closeOnAbuse === true;

        this.clients = new Map();
        this.metrics = {
            limitedByReason: {
                MESSAGE_RATE_LIMIT: 0,
                CLICK_RATE_LIMIT: 0,
                JOIN_RATE_LIMIT: 0,
                PAYLOAD_TOO_LARGE: 0,
                INVALID_JSON_RATE: 0,
                DUPLICATE_ACTION: 0
            },
            duplicateActions: 0,
            oversizedPayloads: 0,
            invalidJson: 0,
            abuseDisconnects: 0
        };
    }

    checkRaw(clientId, byteLength, now = Date.now()) {
        if (!this.enabled) return allow();
        const size = Number(byteLength) || 0;
        if (this.maxPayloadBytes > 0 && size > this.maxPayloadBytes) {
            this.metrics.oversizedPayloads++;
            return this._reject('PAYLOAD_TOO_LARGE', now, {
                message: `Payload exceeds ${this.maxPayloadBytes} bytes`,
                close: this.closeOnAbuse
            });
        }
        this._record(clientId, now);
        return allow();
    }

    checkInvalidJson(clientId, now = Date.now()) {
        if (!this.enabled) {
            this.metrics.invalidJson++;
            return allow();
        }

        const record = this._record(clientId, now);
        record.invalidJson++;
        this.metrics.invalidJson++;

        if (record.invalidJson > this.maxInvalidJson) {
            return this._reject('INVALID_JSON_RATE', now, {
                message: 'Too many malformed JSON messages',
                retryAfterMs: this._retryAfter(record, now),
                close: this.closeOnAbuse
            });
        }
        return allow();
    }

    checkMessage(clientId, message, now = Date.now()) {
        if (!this.enabled) return allow();

        const record = this._record(clientId, now);
        record.messages++;

        if (record.messages > this.maxMessages) {
            return this._reject('MESSAGE_RATE_LIMIT', now, {
                message: 'Too many messages from this client',
                retryAfterMs: this._retryAfter(record, now),
                close: this.closeOnAbuse
            });
        }

        if (message && message.type === 'click') {
            record.clicks++;
            if (record.clicks > this.maxClicks) {
                return this._reject('CLICK_RATE_LIMIT', now, {
                    message: 'Too many click actions from this client',
                    retryAfterMs: this._retryAfter(record, now),
                    close: this.closeOnAbuse
                });
            }

            const duplicateDecision = this._checkDuplicateAction(record, message, now);
            if (!duplicateDecision.allowed) return duplicateDecision;
        }

        if (message && (message.type === 'player_join' || message.type === 'create_session')) {
            record.joins++;
            if (record.joins > this.maxJoins) {
                return this._reject('JOIN_RATE_LIMIT', now, {
                    message: 'Too many join/session requests from this client',
                    retryAfterMs: this._retryAfter(record, now),
                    close: this.closeOnAbuse
                });
            }
        }

        return allow();
    }

    cleanupClient(clientId) {
        this.clients.delete(clientId);
    }

    cleanup(now = Date.now()) {
        for (const [clientId, record] of this.clients.entries()) {
            if (now - record.lastSeen > Math.max(this.windowMs * 5, this.actionIdTtlMs * 2)) {
                this.clients.delete(clientId);
                continue;
            }
            this._pruneActionIds(record, now);
        }
    }

    recordAbuseDisconnect() {
        this.metrics.abuseDisconnects++;
    }

    getMetrics() {
        return {
            enabled: this.enabled,
            trackedClients: this.clients.size,
            limitedByReason: { ...this.metrics.limitedByReason },
            duplicateActions: this.metrics.duplicateActions,
            oversizedPayloads: this.metrics.oversizedPayloads,
            invalidJson: this.metrics.invalidJson,
            abuseDisconnects: this.metrics.abuseDisconnects
        };
    }

    getConfig() {
        return {
            enabled: this.enabled,
            windowMs: this.windowMs,
            maxMessages: this.maxMessages,
            maxClicks: this.maxClicks,
            maxJoins: this.maxJoins,
            maxInvalidJson: this.maxInvalidJson,
            maxPayloadBytes: this.maxPayloadBytes,
            actionIdTtlMs: this.actionIdTtlMs,
            closeOnAbuse: this.closeOnAbuse
        };
    }

    _record(clientId, now) {
        let record = this.clients.get(clientId);
        if (!record) {
            record = createRecord(now);
            this.clients.set(clientId, record);
            return record;
        }

        record.lastSeen = now;
        if (now - record.windowStart >= this.windowMs) {
            record.windowStart = now;
            record.messages = 0;
            record.clicks = 0;
            record.joins = 0;
            record.invalidJson = 0;
        }
        this._pruneActionIds(record, now);
        return record;
    }

    _checkDuplicateAction(record, message, now) {
        if (message.actionId === undefined || message.actionId === null || message.actionId === '') {
            return allow();
        }

        const actionKey = `${message.playerId || 'unknown'}:${String(message.actionId)}`;
        if (record.actionIds.has(actionKey)) {
            this.metrics.duplicateActions++;
            return this._reject('DUPLICATE_ACTION', now, {
                message: 'Duplicate actionId received',
                retryAfterMs: 0,
                close: false
            });
        }
        record.actionIds.set(actionKey, now);
        return allow();
    }

    _pruneActionIds(record, now) {
        for (const [actionKey, seenAt] of record.actionIds.entries()) {
            if (now - seenAt > this.actionIdTtlMs) {
                record.actionIds.delete(actionKey);
            }
        }
    }

    _retryAfter(record, now) {
        return Math.max(0, record.windowStart + this.windowMs - now);
    }

    _reject(code, now, details = {}) {
        this.metrics.limitedByReason[code] = (this.metrics.limitedByReason[code] || 0) + 1;
        return {
            allowed: false,
            code,
            message: details.message || code,
            retryAfterMs: details.retryAfterMs !== undefined ? details.retryAfterMs : this.windowMs,
            close: details.close === true,
            timestamp: now
        };
    }
}

function createRecord(now) {
    return {
        windowStart: now,
        lastSeen: now,
        messages: 0,
        clicks: 0,
        joins: 0,
        invalidJson: 0,
        actionIds: new Map()
    };
}

function allow() {
    return { allowed: true };
}

function positiveInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

module.exports = RateLimiter;
