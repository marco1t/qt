const WebSocket = require('ws');

// ============================================================
// simulate-team-clicks.js
// Simule des clics répartis équitablement entre les bots
// d'une équipe, en envoyant les messages en ROUND-ROBIN
// par lots pour ne pas saturer le buffer WebSocket.
//
// Usage: node simulate-team-clicks.js <A|B|rouge|bleu> <NB_CLICS>
// ============================================================

const BATCH_SIZE = 500;   // Clics envoyés par tranche avant de rendre la main
const BATCH_DELAY_MS = 10;  // Délai entre chaque tranche (ms)
const PORT = 7777;

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node simulate-team-clicks.js <A|B|rouge|bleu> <NB_CLICS> [host]");
    console.error("   Ex local   : node simulate-team-clicks.js A 30000");
    console.error("   Ex distant : node simulate-team-clicks.js A 30000 clickwars.ftp.sh");
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

const totalClicks = parseInt(args[1]);
const HOST = args[2] || 'localhost';
if (isNaN(totalClicks) || totalClicks <= 0) {
    console.error("❌ Nombre de clics invalide.");
    process.exit(1);
}

console.log(`\n🤖 Simulation : ${totalClicks.toLocaleString()} clics pour l'équipe ${targetTeam} (round-robin)`);
console.log(`⚙  Batch : ${BATCH_SIZE} clics / ${BATCH_DELAY_MS}ms\n`);

const ws = new WebSocket(`ws://${HOST}:${PORT}`);

let bots = [];
let sentTotal = 0;
let startTime = null;
let initialized = false;
let done = false;

// ─────────────────────────────────────────────────────────
// Connexion
// ─────────────────────────────────────────────────────────
ws.on('open', () => {
    console.log('✅ Connecté au serveur de jeu.');
});

// ─────────────────────────────────────────────────────────
// Réception du premier état → on démarre l'envoi
// ─────────────────────────────────────────────────────────
ws.on('message', (data) => {
    if (initialized || done) return;

    try {
        const msg = JSON.parse(data.toString());

        // On attend le premier message contenant la liste de joueurs
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
        bots.forEach(b => console.log(`   - ${b.name} (${b.id})`));
        console.log(`\n📡 Envoi en cours...\n`);

        sendBatch();

    } catch (e) { /* ignorer les messages non-JSON */ }
});

// ─────────────────────────────────────────────────────────
// Envoi round-robin par lots
// ─────────────────────────────────────────────────────────
function sendBatch() {
    if (done) return;

    // Nombre de clics à envoyer dans ce lot
    const remaining = totalClicks - sentTotal;
    if (remaining <= 0) {
        finish();
        return;
    }

    const batchCount = Math.min(BATCH_SIZE, remaining);

    // Round-robin : on alterne entre les bots
    for (let i = 0; i < batchCount; i++) {
        const bot = bots[(sentTotal + i) % bots.length];
        ws.send(JSON.stringify({
            type: 'click',
            playerId: bot.id,
            timestamp: Date.now()
        }));
    }

    sentTotal += batchCount;

    // Afficher la progression
    const pct = Math.round((sentTotal / totalClicks) * 100);
    const bar = barStr(sentTotal, totalClicks, 30);
    process.stdout.write(`\r${bar} ${pct}% — ${sentTotal.toLocaleString()} / ${totalClicks.toLocaleString()} clics`);

    // Programmer le lot suivant
    setTimeout(sendBatch, BATCH_DELAY_MS);
}

// ─────────────────────────────────────────────────────────
// Fin de l'envoi
// ─────────────────────────────────────────────────────────
function finish() {
    if (done) return;
    done = true;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const perBot = Math.floor(totalClicks / bots.length);
    const cps = Math.round(totalClicks / parseFloat(duration));

    console.log(`\n\n✅ Terminé !`);
    console.log(`   📊 Total envoyés : ${sentTotal.toLocaleString()}`);
    console.log(`   🤖 Clics/bot     : ~${perBot.toLocaleString()} (répartition round-robin)`);
    console.log(`   ⏱  Durée         : ${duration}s`);
    console.log(`   🚀 Débit         : ${cps.toLocaleString()} clics/s\n`);

    setTimeout(() => { ws.close(); process.exit(0); }, 300);
}

// ─────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────
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
    console.log(`\n\n🛑 Interrompu — ${sentTotal.toLocaleString()} clics envoyés.`);
    ws.close(); process.exit(0);
});
