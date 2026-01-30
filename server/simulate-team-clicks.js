const WebSocket = require('ws');

// Configuration
const PORT = 7777;
const URL = `ws://localhost:${PORT}`;

// Arguments : node simulate-team-clicks.js <TEAM> <CLICKS>
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("❌ Usage: node simulate-team-clicks.js <TEAM_A|TEAM_B> <NUMBER_OF_CLICKS>");
    console.error("   Ex: node simulate-team-clicks.js A 1000");
    console.error("   Ex: node simulate-team-clicks.js rouge 500");
    process.exit(1);
}

// Normaliser l'équipe (A/Rouge ou B/Bleu)
let targetTeam = args[0].toUpperCase();
if (targetTeam === "ROUGE" || targetTeam === "RED") targetTeam = "A";
if (targetTeam === "BLEU" || targetTeam === "BLUE") targetTeam = "B";

if (targetTeam !== "A" && targetTeam !== "B") {
    console.error("❌ Équipe invalide. Utilisez A, B, Rouge ou Bleu.");
    process.exit(1);
}

const totalClicks = parseInt(args[1]);
if (isNaN(totalClicks) || totalClicks <= 0) {
    console.error("❌ Nombre de clics invalide.");
    process.exit(1);
}

console.log(`🤖 Initialisation simulation: ${totalClicks} clics pour l'équipe ${targetTeam}...`);

const ws = new WebSocket(URL);

ws.on('open', function open() {
    console.log('✅ Connecté au serveur de jeu.');
    // On attend la mise à jour de l'état pour trouver les bots
});

ws.on('message', function incoming(data) {
    try {
        const message = JSON.parse(data);

        // On écoute les mises à jour pour connaître la liste des joueurs
        if (message.type === 'lobby_update' || message.type === 'state_update') {
            const players = message.players;

            // 1. Trouver les bots de l'équipe cible
            const bots = players.filter(p => p.isBot && p.team === targetTeam);

            if (bots.length === 0) {
                console.error(`❌ Aucun bot trouvé dans l'équipe ${targetTeam} !`);
                console.error("   Ajoutez des bots dans l'équipe via le Lobby d'abord.");
                process.exit(1);
            }

            console.log(`ℹ️  Bots trouvés dans l'équipe ${targetTeam}: ${bots.length}`);
            bots.forEach(b => console.log(`   - ${b.name} (${b.id})`));

            // 2. Répartir les clics
            const baseClicks = Math.floor(totalClicks / bots.length);
            let remainder = totalClicks % bots.length;

            console.log(`⚡ Distribution: ~${baseClicks} clics par bot`);

            let sentCount = 0;

            // 3. Envoyer les clics
            const startTime = Date.now();

            bots.forEach((bot, index) => {
                // Le bot prend sa part + 1 si il reste du "remainder"
                let myClicks = baseClicks + (index < remainder ? 1 : 0);

                for (let i = 0; i < myClicks; i++) {
                    ws.send(JSON.stringify({
                        type: 'click',
                        playerId: bot.id, // On simule un clic venant de CE bot
                        timestamp: Date.now()
                    }));
                    sentCount++;
                }
            });

            const duration = (Date.now() - startTime) / 1000;
            console.log(`✅ Terminée ! ${sentCount} clics envoyés en ${duration.toFixed(3)}s.`);

            ws.close();
            process.exit(0);
        }

    } catch (e) {
        console.error("Erreur:", e);
        process.exit(1);
    }
});

ws.on('error', function error(err) {
    console.error('❌ Erreur de connexion:', err.message);
    process.exit(1);
});
