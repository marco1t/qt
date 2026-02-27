const WebSocket = require('ws');

// ============================================================
// simulate-team-clicks.js
// Simule des clics pour chaque bot indépendamment avec un
// délai aléatoire entre deux intervalles donnés.
//
// Usage: node simulate-team-clicks.js <A|B|rouge|bleu> <NB_CLICS> <MIN_MS> <MAX_MS> [host]
//   Ex : node simulate-team-clicks.js A 100 1000 5000
//        → chaque bot de l'équipe A envoie 100 clics,
//          en attendant entre 1s et 5s entre chaque clic
// ============================================================

const PORT = 7777;

const args = process.argv.slice(2);
if (args.length < 4) {
    console.error("Usage: node simulate-team-clicks.js <A|B|rouge|bleu> <NB_CLICS> <MIN_DELAY_MS> <MAX_DELAY_MS> [host]");
    console.error("   Ex local   : node simulate-team-clicks.js A 100 1000 5000");
    console.error("   Ex distant : node simulate-team-clicks.js A 100 500 2000 clickwars.ftp.sh");
    console.error("");
    console.error("   Chaque bot de l'équipe cliquera NB_CLICS fois,");
    console.error("   avec un délai aléatoire entre MIN et MAX (en ms) entre chaque clic.");
    process.exit(1);
}

// Normaliser l'équipe
let targetTeam = args[0].toUpperCase();
if (targetTeam === "ROUGE" || targetTeam === "RED") targetTeam = "A";
if (targetTeam === "BLEU" || targetTeam === "BLUE") targetTeam = "B";

if (targetTeam !== "A" && targetTeam !== "B") {
    console.error("❌ Équipe invalide. Utilisez A, B, rouge ou bleu.");
    process.exit(1);
}

const clicksPerBot = parseInt(args[1]);
if (isNaN(clicksPerBot) || clicksPerBot <= 0) {
    console.error("❌ Nombre de clics invalide.");
    process.exit(1);
}

const minDelay = parseInt(args[2]);
const maxDelay = parseInt(args[3]);
if (isNaN(minDelay) || isNaN(maxDelay) || minDelay <= 0 || maxDelay <= 0 || minDelay > maxDelay) {
    console.error("❌ Intervalles invalides. MIN_DELAY doit être <= MAX_DELAY et > 0.");
    process.exit(1);
}

const HOST = args[4] || 'localhost';

console.log(`\n🤖 Simulation indépendante par bot`);
console.log(`   Équipe       : ${targetTeam}`);
console.log(`   Clics/bot    : ${clicksPerBot}`);
console.log(`   Intervalle   : ${minDelay}ms — ${maxDelay}ms (aléatoire)`);
console.log(`   Serveur      : ${HOST}:${PORT}\n`);

// ─────────────────────────────────────────────────────────
// Couleurs console pour différencier les bots
// ─────────────────────────────────────────────────────────
const COLORS = [
    '\x1b[36m', // cyan
    '\x1b[33m', // yellow
    '\x1b[35m', // magenta
    '\x1b[32m', // green
    '\x1b[34m', // blue
    '\x1b[91m', // light red
    '\x1b[96m', // light cyan
    '\x1b[93m', // light yellow
    '\x1b[95m', // light magenta
    '\x1b[92m', // light green
];
const RESET = '\x1b[0m';

// ─────────────────────────────────────────────────────────
// Connexion WebSocket
// ─────────────────────────────────────────────────────────
const ws = new WebSocket(`ws://${HOST}:${PORT}`);

let bots = [];
let initialized = false;
let gameOver = false;
let startTime = null;
let botsFinished = 0;
let totalSent = 0;

ws.on('open', () => {
    console.log('✅ Connecté au serveur de jeu.');
});

// ─────────────────────────────────────────────────────────
// Réception du premier état → démarrer les bots
// ─────────────────────────────────────────────────────────
ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());

        // Détecter la fin de partie
        if (msg.type === 'victory') {
            gameOver = true;
            console.log(`\n🏆 Victoire détectée ! Arrêt des bots...`);
            return;
        }

        if (initialized) return;

        if (msg.type !== 'state_update' && msg.type !== 'lobby_update') return;

        const players = msg.players || [];
        bots = players.filter(p => p.isBot && p.team === targetTeam);

        if (bots.length === 0) {
            console.error(`❌ Aucun bot dans l'équipe ${targetTeam}.`);
            console.error("   → Ajoutez des bots avec : node add-lobby-bots.js --rouge N --bleu N");
            ws.close(); process.exit(1);
        }

        initialized = true;
        startTime = Date.now();

        console.log(`ℹ  ${bots.length} bot(s) trouvé(s) dans l'équipe ${targetTeam}:`);
        bots.forEach((b, i) => {
            const color = COLORS[i % COLORS.length];
            console.log(`   ${color}● ${b.name} (${b.id})${RESET}`);
        });

        const totalExpected = clicksPerBot * bots.length;
        console.log(`\n📡 Lancement de ${totalExpected.toLocaleString()} clics (${clicksPerBot} × ${bots.length} bots)\n`);
        console.log(`${'─'.repeat(60)}`);

        // Lancer chaque bot indépendamment
        bots.forEach((bot, index) => {
            startBotLoop(bot, index);
        });

    } catch (e) { /* ignorer les messages non-JSON */ }
});

// ─────────────────────────────────────────────────────────
// Boucle indépendante par bot
// ─────────────────────────────────────────────────────────
function startBotLoop(bot, botIndex) {
    const color = COLORS[botIndex % COLORS.length];
    let sent = 0;

    function sendNextClick() {
        // Arrêt si la partie est finie ou si le bot a tout envoyé
        if (gameOver) {
            botDone(bot, botIndex, sent, 'partie terminée');
            return;
        }
        if (sent >= clicksPerBot) {
            botDone(bot, botIndex, sent, 'objectif atteint');
            return;
        }

        // Envoyer le clic
        ws.send(JSON.stringify({
            type: 'click',
            playerId: bot.id,
            timestamp: Date.now()
        }));
        sent++;
        totalSent++;

        // Afficher la progression
        const pct = Math.round((sent / clicksPerBot) * 100);
        const bar = barStr(sent, clicksPerBot, 20);
        console.log(`${color}  [${bot.name}] ${bar} ${pct}% (${sent}/${clicksPerBot})${RESET}`);

        // Planifier le prochain clic avec un délai aléatoire
        const delay = randomBetween(minDelay, maxDelay);
        setTimeout(sendNextClick, delay);
    }

    // Démarrer après un petit délai décalé pour ne pas que tous démarrent pile en même temps
    const initialDelay = randomBetween(0, Math.min(500, minDelay));
    setTimeout(sendNextClick, initialDelay);
}

function botDone(bot, botIndex, sent, reason) {
    const color = COLORS[botIndex % COLORS.length];
    console.log(`${color}  ✔ ${bot.name} terminé — ${sent} clics envoyés (${reason})${RESET}`);
    botsFinished++;

    if (botsFinished >= bots.length) {
        finish();
    }
}

// ─────────────────────────────────────────────────────────
// Fin de la simulation
// ─────────────────────────────────────────────────────────
function finish() {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const cps = totalSent > 0 ? Math.round(totalSent / parseFloat(duration)) : 0;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`\n✅ Simulation terminée !`);
    console.log(`   📊 Total envoyés : ${totalSent.toLocaleString()}`);
    console.log(`   🤖 Bots          : ${bots.length}`);
    console.log(`   ⏱  Durée         : ${duration}s`);
    console.log(`   🚀 Débit moyen   : ${cps.toLocaleString()} clics/s`);
    console.log(`   ⏳ Intervalle    : ${minDelay}ms — ${maxDelay}ms\n`);

    setTimeout(() => { ws.close(); process.exit(0); }, 500);
}

// ─────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function barStr(current, total, width) {
    const filled = Math.round((current / total) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

ws.on('error', (err) => {
    console.error('\n❌ Erreur de connexion:', err.message);
    console.error('   → Vérifiez que le serveur tourne sur le port', PORT);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log(`\n\n🛑 Interrompu — ${totalSent.toLocaleString()} clics envoyés.`);
    ws.close(); process.exit(0);
});
