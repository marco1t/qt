#!/usr/bin/env node

/**
 * simulate-clicks.js - Simule des clics de bot pour tester les performances
 * 
 * Usage:
 *   node simulate-clicks.js [team] [clicks] [port]
 * 
 * Arguments:
 *   team   - Équipe cible: "rouge" ou "bleu" (ou "A" ou "B")
 *   clicks - Nombre de clics à simuler (par défaut: 100)
 *   port   - Port du serveur WebSocket (par défaut: 7777)
 * 
 * Exemples:
 *   node simulate-clicks.js bleu 10000
 *   node simulate-clicks.js rouge 5000 7777
 *   node simulate-clicks.js A 1000
 */

const WebSocket = require('ws');

// Parsing des arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🤖 Simulateur de Clics - ClickWars Bot              ║
╚══════════════════════════════════════════════════════════════╝

📖 USAGE:
   node simulate-clicks.js [team] [clicks] [port]

📋 ARGUMENTS:
   team   - Équipe cible (obligatoire)
            • "rouge" ou "A" pour l'équipe rouge
            • "bleu"  ou "B" pour l'équipe bleue
            
   clicks - Nombre de clics à simuler (défaut: 100)
   
   port   - Port du serveur WebSocket (défaut: 7777)

💡 EXEMPLES:
   node simulate-clicks.js bleu 10000
   → Simule 10000 clics pour l'équipe bleue
   
   node simulate-clicks.js rouge 5000
   → Simule 5000 clics pour l'équipe rouge
   
   node simulate-clicks.js A 1000 7777
   → Simule 1000 clics pour l'équipe A sur le port 7777

⚠️  NOTES:
   • Le serveur doit être en cours d'exécution
   • Le jeu doit être en phase "playing" pour que les clics comptent
   • Les clics sont envoyés aussi rapidement que possible
    `);
    process.exit(0);
}

// Configuration
const teamArg = args[0].toLowerCase();
const clickCount = parseInt(args[1]) || 100;
const port = parseInt(args[2]) || 7777;
const host = args[3] || 'localhost';

// Déterminer l'équipe (A ou B)
let team;
if (teamArg === 'rouge' || teamArg === 'red' || teamArg === 'a') {
    team = 'A';
} else if (teamArg === 'bleu' || teamArg === 'blue' || teamArg === 'b') {
    team = 'B';
} else {
    console.error(`❌ Équipe invalide: "${args[0]}"`);
    console.error(`   Utilisez: rouge/bleu ou A/B`);
    process.exit(1);
}

const teamName = team === 'A' ? 'ROUGE' : 'BLEUE';
const serverUrl = `ws://${host}:${port}`;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🤖 Démarrage Simulateur de Clics                    ║
╚══════════════════════════════════════════════════════════════╝

🎯 Cible      : Équipe ${teamName} (Team ${team})
🔢 Clics      : ${clickCount.toLocaleString()}
🌐 Serveur    : ${serverUrl}
⏱️  Démarrage  : ${new Date().toLocaleTimeString()}

🔌 Connexion au serveur...
`);

// Créer la connexion WebSocket
const ws = new WebSocket(serverUrl);

// ID unique pour ce bot
const botId = `bot_load_test_${Date.now()}`;
const botName = `Bot Test ${team}`;

// Statistiques
let clicksSent = 0;
let clicksRemaining = clickCount;
let startTime;
let connected = false;

// Connexion établie
ws.on('open', () => {
    console.log('✅ Connecté au serveur\n');
    connected = true;

    // S'enregistrer comme joueur
    const joinMessage = {
        type: 'player_join',
        playerId: botId,
        name: botName,
        team: team  // Le serveur peut auto-balancer, mais on essaie de spécifier
    };

    ws.send(JSON.stringify(joinMessage));
    console.log(`👤 Enregistrement du bot: ${botName}`);
    console.log(`📨 En attente de confirmation...\n`);

    // Attendre un peu que le serveur confirme l'inscription
    setTimeout(() => {
        startSimulation();
    }, 500);
});

// Fonction pour démarrer la simulation
function startSimulation() {
    console.log(`🚀 DÉBUT DE LA SIMULATION`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    startTime = Date.now();

    // Stratégie: Envoyer les clics par paquets pour ne pas surcharger
    const BATCH_SIZE = 100;  // Nombre de clics par paquet
    const BATCH_DELAY = 10;   // Délai entre les paquets (ms)

    sendClickBatch();

    function sendClickBatch() {
        if (clicksRemaining <= 0) {
            finishSimulation();
            return;
        }

        const batchSize = Math.min(BATCH_SIZE, clicksRemaining);

        for (let i = 0; i < batchSize; i++) {
            const clickMessage = {
                type: 'click',
                playerId: botId
            };

            try {
                ws.send(JSON.stringify(clickMessage));
                clicksSent++;
                clicksRemaining--;
            } catch (error) {
                console.error(`❌ Erreur lors de l'envoi du clic ${clicksSent}:`, error.message);
            }
        }

        // Afficher la progression
        const progress = ((clicksSent / clickCount) * 100).toFixed(1);
        const bar = createProgressBar(clicksSent, clickCount, 40);
        process.stdout.write(`\r${bar} ${progress}% (${clicksSent.toLocaleString()}/${clickCount.toLocaleString()})`);

        // Continuer avec le prochain paquet
        setTimeout(sendClickBatch, BATCH_DELAY);
    }
}

// Fonction pour créer une barre de progression
function createProgressBar(current, total, width) {
    const percentage = current / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Fonction pour terminer la simulation
function finishSimulation() {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const clicksPerSecond = Math.round(clickCount / duration);

    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ SIMULATION TERMINÉE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`📊 RÉSULTATS:`);
    console.log(`   • Clics envoyés  : ${clicksSent.toLocaleString()}`);
    console.log(`   • Durée          : ${duration.toFixed(2)}s`);
    console.log(`   • Débit moyen    : ${clicksPerSecond.toLocaleString()} clics/s`);
    console.log(`   • Équipe cible   : ${teamName}`);
    console.log(`\n💡 Le serveur devrait avoir reçu tous les clics.`);
    console.log(`   Vérifiez l'interface du jeu pour voir l'impact.\n`);

    // Fermer la connexion après un petit délai
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 1000);
}

// Réception de messages
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());

        // Afficher les messages importants
        if (message.type === 'state_update' && !startTime) {
            // Première mise à jour d'état - afficher les jauges
            console.log(`📊 État initial:`);
            console.log(`   • Jauge Rouge : ${message.teamAGauge || 0}/${message.maxGauge || 100}`);
            console.log(`   • Jauge Bleue : ${message.teamBGauge || 0}/${message.maxGauge || 100}`);
            console.log(`   • Phase       : ${message.phase}`);
            console.log(``);
        }

        if (message.type === 'victory') {
            const winnerName = message.winner === 'A' ? 'ROUGE' : 'BLEUE';
            console.log(`\n\n🏆 VICTOIRE pour l'équipe ${winnerName}!`);
        }

    } catch (error) {
        // Ignorer les erreurs de parsing
    }
});

// Gestion des erreurs
ws.on('error', (error) => {
    console.error(`\n❌ ERREUR WebSocket:`, error.message);
    console.error(`\n💡 Vérifiez que:`);
    console.error(`   • Le serveur est démarré (node websocket-server.js)`);
    console.error(`   • Le port ${port} est correct`);
    console.error(`   • Aucun firewall ne bloque la connexion\n`);
    process.exit(1);
});

// Déconnexion
ws.on('close', () => {
    if (!connected) {
        console.error(`\n❌ Impossible de se connecter au serveur ${serverUrl}`);
        console.error(`\n💡 Démarrez d'abord le serveur avec:`);
        console.error(`   node websocket-server.js\n`);
        process.exit(1);
    }
});

// Gestion de l'interruption (Ctrl+C)
process.on('SIGINT', () => {
    console.log(`\n\n🛑 Interruption de la simulation...`);
    console.log(`📊 Clics envoyés avant interruption: ${clicksSent.toLocaleString()}\n`);
    ws.close();
    process.exit(0);
});
