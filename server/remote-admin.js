/**
 * remote-admin.js - Administration à distance du serveur ClickWars
 *
 * Usage:
 *   node remote-admin.js reset                        (serveur local)
 *   node remote-admin.js reset clickwars-ws.3sigma-studios.com
 *   node remote-admin.js start clickwars-ws.3sigma-studios.com
 *   node remote-admin.js status clickwars-ws.3sigma-studios.com
 */

const WebSocket = require('ws');

const ACTION = process.argv[2] || 'status';
const HOST   = process.argv[3] || '127.0.0.1';
const PORT   = process.argv[4] || '7777';

// Résolution automatique du protocole et de l'URL
const isRemote = HOST.includes('.') && isNaN(HOST.split('.')[0]);
const wsUrl = isRemote ? `wss://${HOST}` : `ws://${HOST}:${PORT}`;

const ACTION_MAP = {
    reset:  { type: 'reset_game',  label: 'Reset + relance de la partie' },
    start:  { type: 'start_game',  label: 'Démarrage de la partie'        },
    status: { type: 'ping',        label: 'Vérification du statut'        },
};

const action = ACTION_MAP[ACTION];

if (!action) {
    console.error(`Action inconnue : "${ACTION}"`);
    console.error(`Actions disponibles : ${Object.keys(ACTION_MAP).join(', ')}`);
    process.exit(1);
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║       ClickWars Remote Admin         ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Serveur  : ${wsUrl.padEnd(24)} ║`);
console.log(`║  Action   : ${action.label.padEnd(24)} ║`);
console.log('╚══════════════════════════════════════╝');
console.log('');

const ws = new WebSocket(wsUrl);

const timeout = setTimeout(() => {
    console.error('Timeout : impossible de joindre le serveur.');
    process.exit(1);
}, 7000);

ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error(`Erreur de connexion : ${err.message}`);
    process.exit(1);
});

ws.on('open', () => {
    clearTimeout(timeout);
    console.log('Connexion etablie.');

    if (ACTION === 'status') {
        // Pour le status on attend juste le premier message d'état
        console.log('En attente du statut du serveur...');
        return;
    }

    // Envoi de la commande
    ws.send(JSON.stringify({
        type: action.type,
        timestamp: Date.now()
    }));

    console.log(`Commande "${action.type}" envoyee.`);

    // Attendre la réponse du serveur puis quitter
    setTimeout(() => {
        ws.close();
        console.log('Fermeture de la connexion.');
        process.exit(0);
    }, 1500);
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data);

        if (ACTION === 'status') {
            clearTimeout(timeout);

            if (msg.type === 'game_state' || msg.state) {
                const state = msg.state || msg;
                const phase = state.phase || msg.type;
                const teamA = state.teamA?.gauge ?? 'N/A';
                const teamB = state.teamB?.gauge ?? 'N/A';

                console.log('');
                console.log('─── Etat du serveur ──────────────────────');
                console.log(`  Phase  : ${phase}`);
                console.log(`  Team A : ${teamA}`);
                console.log(`  Team B : ${teamB}`);
                console.log('──────────────────────────────────────────');
            } else {
                console.log(`Message recu : ${JSON.stringify(msg).slice(0, 120)}`);
            }

            setTimeout(() => {
                ws.close();
                process.exit(0);
            }, 500);
        }
    } catch {
        // Message non-JSON, on ignore
    }
});
