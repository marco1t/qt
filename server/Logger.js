/**
 * Logger.js - Structured logging for Loki integration
 *
 * Outputs JSON logs with: timestamp, level, event, instanceId, and extra fields.
 * Supports both human-readable (default) and JSON mode (LOG_FORMAT=json).
 *
 * Usage:
 *   const logger = require('./Logger')('my-instance-id');
 *   logger.info('connect', { clientId: 'abc', ip: '1.2.3.4' });
 *   logger.warn('throttle', { clientId: 'abc' });
 *   logger.error('crash', { error: 'something broke' });
 */

const LOG_FORMAT = process.env.LOG_FORMAT || 'text'; // 'text' or 'json'

function createLogger(instanceId) {
    const shortId = (instanceId || 'unknown').slice(0, 8);

    function log(level, event, extra = {}) {
        const entry = {
            ts: new Date().toISOString(),
            level,
            event,
            instanceId: shortId,
            ...extra
        };

        if (LOG_FORMAT === 'json') {
            // Structured JSON for Loki
            const line = JSON.stringify(entry);
            if (level === 'error') {
                process.stderr.write(line + '\n');
            } else {
                process.stdout.write(line + '\n');
            }
        } else {
            // Human-readable with TAG prefix
            const TAG = `[instance:${shortId}]`;
            const extraStr = Object.keys(extra).length > 0
                ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')
                : '';
            const msg = `${TAG} [${level.toUpperCase()}] ${event}${extraStr}`;
            if (level === 'error') {
                console.error(msg);
            } else if (level === 'warn') {
                console.warn(msg);
            } else {
                console.log(msg);
            }
        }

        return entry; // Return for dashboard streaming
    }

    return {
        info:  (event, extra) => log('info', event, extra),
        warn:  (event, extra) => log('warn', event, extra),
        error: (event, extra) => log('error', event, extra),
        debug: (event, extra) => log('debug', event, extra),
    };
}

module.exports = createLogger;
