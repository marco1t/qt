#!/usr/bin/env node

/**
 * add-lobby-bots.js - Ajoute des bots dans le lobby du jeu
 * 
 * Usage:
 *   node add-lobby-bots.js --rouge <N> --bleu <N>
 *   node add-lobby-bots.js <nombre> <équipe>
 * 
 * Exemples:
 *   node add-lobby-bots.js --rouge 50 --bleu 30   # 50 bots rouges + 30 bots bleus
 *   node add-lobby-bots.js --rouge 100            # 100 bots rouges uniquement
 *   node add-lobby-bots.js --bleu 200             # 200 bots bleus uniquement
 *   node add-lobby-bots.js 50 rouge               # 50 bots rouges (ancien format)
 */

const WebSocket = require('ws');

// Parsing des arguments
const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🤖 Ajout de Bots dans le Lobby - ClickWars          ║
╚══════════════════════════════════════════════════════════════╝

📖 USAGE (Nouveau format recommandé):
   node add-lobby-bots.js --rouge <N> --bleu <N>

📋 OPTIONS:
   --rouge <N>  Nombre de bots à ajouter dans l'équipe ROUGE
   --bleu <N>   Nombre de bots à ajouter dans l'équipe BLEUE
   --port <N>   Port du serveur WebSocket (défaut: 7777)

💡 EXEMPLES:
   node add-lobby-bots.js --rouge 50 --bleu 30
   → Ajoute 50 bots rouges + 30 bots bleus = 80 bots au total
   
   node add-lobby-bots.js --rouge 100
   → Ajoute 100 bots uniquement dans l'équipe rouge
   
   node add-lobby-bots.js --bleu 200
   → Ajoute 200 bots uniquement dans l'équipe bleue
   
   node add-lobby-bots.js --rouge 25 --bleu 25
   → Équipes parfaitement équilibrées avec 25 bots chacune

📖 USAGE (Ancien format):
   node add-lobby-bots.js <nombre> <équipe>
   
   Exemples:
   node add-lobby-bots.js 50 rouge
   node add-lobby-bots.js 100 bleu

⚠️  NOTES:
   • Le serveur doit être en cours d'exécution
   • Les bots seront contrôlés automatiquement par le serveur
   • Pendant le jeu, les bots cliqueront automatiquement
    `);
    process.exit(0);
}

// Nouvelle méthode de parsing : --rouge X --bleu Y
let rougeBots = 0;
let bleuBots = 0;
let port = 7777;
let useNewFormat = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rouge' || args[i] === '-r') {
        rougeBots = parseInt(args[i + 1]) || 0;
        useNewFormat = true;
        i++;
    } else if (args[i] === '--bleu' || args[i] === '-b') {
        bleuBots = parseInt(args[i + 1]) || 0;
        useNewFormat = true;
        i++;
    } else if (args[i] === '--port' || args[i] === '-p') {
        port = parseInt(args[i + 1]) || 7777;
        i++;
    }
}

// Si nouveau format non utilisé, fallback sur l'ancien format
let targetTeam = null;
let botCount = 0;

if (!useNewFormat) {
    botCount = parseInt(args[0]) || 10;
    const teamArg = (args[1] || 'auto').toLowerCase();
    port = parseInt(args[2]) || 7777;

    if (teamArg === 'rouge' || teamArg === 'red' || teamArg === 'a') {
        targetTeam = 'A';
        rougeBots = botCount;
    } else if (teamArg === 'bleu' || teamArg === 'blue' || teamArg === 'b') {
        targetTeam = 'B';
        bleuBots = botCount;
    } else if (teamArg === 'auto') {
        // Répartition automatique
        rougeBots = Math.ceil(botCount / 2);
        bleuBots = Math.floor(botCount / 2);
    } else {
        console.error(`❌ Équipe invalide: "${args[1]}"`);
        console.error(`   Utilisez: rouge/bleu, A/B, ou auto`);
        process.exit(1);
    }
}

const totalBots = rougeBots + bleuBots;
const serverUrl = `ws://localhost:${port}`;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🤖 Ajout de Bots dans le Lobby                      ║
╚══════════════════════════════════════════════════════════════╝

🔴 Équipe ROUGE : ${rougeBots.toLocaleString()} bots
🔵 Équipe BLEUE : ${bleuBots.toLocaleString()} bots
📊 Total        : ${totalBots.toLocaleString()} bots
🌐 Serveur      : ${serverUrl}
⏱️  Démarrage    : ${new Date().toLocaleTimeString()}

🔌 Connexion au serveur...
`);

if (totalBots === 0) {
    console.error(`❌ Aucun bot à ajouter!`);
    console.error(`   Utilisez: node add-lobby-bots.js --rouge 50 --bleu 30`);
    process.exit(1);
}

// Créer la connexion WebSocket
const ws = new WebSocket(serverUrl);

// Liste des bots à ajouter (rouge d'abord, puis bleu)
const botsToAdd = [];
for (let i = 1; i <= rougeBots; i++) {
    botsToAdd.push({ name: `Bot_Rouge_${i}`, team: 'A' });
}
for (let i = 1; i <= bleuBots; i++) {
    botsToAdd.push({ name: `Bot_Bleu_${i}`, team: 'B' });
}

// Statistiques
let botsAdded = 0;
let currentIndex = 0;
let startTime;
let connected = false;

// Connexion établie
ws.on('open', () => {
    console.log('✅ Connecté au serveur\n');
    connected = true;
    startTime = Date.now();

    console.log(`🚀 AJOUT DES BOTS EN COURS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Ajouter les bots progressivement
    addNextBot();
});

// Fonction pour ajouter un bot
function addNextBot() {
    if (currentIndex >= botsToAdd.length) {
        finishAdding();
        return;
    }

    const bot = botsToAdd[currentIndex];
    const botMessage = {
        type: 'add_bot',
        name: bot.name,
        team: bot.team
    };

    try {
        ws.send(JSON.stringify(botMessage));
        botsAdded++;
        currentIndex++;
    } catch (error) {
        console.error(`❌ Erreur lors de l'ajout de ${bot.name}:`, error.message);
        currentIndex++;
    }

    // Afficher la progression
    const progress = ((botsAdded / totalBots) * 100).toFixed(1);
    const bar = createProgressBar(botsAdded, totalBots, 40);
    process.stdout.write(`\r${bar} ${progress}% (${botsAdded.toLocaleString()}/${totalBots.toLocaleString()})`);

    // Délai entre chaque ajout pour ne pas surcharger le serveur
    const delay = totalBots > 100 ? 20 : (totalBots > 50 ? 10 : 5);
    setTimeout(addNextBot, delay);
}

// Fonction pour créer une barre de progression
function createProgressBar(current, total, width) {
    const percentage = current / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Fonction pour terminer l'ajout
function finishAdding() {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const botsPerSecond = Math.round(totalBots / duration);

    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ AJOUT TERMINÉ`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`📊 RÉSULTATS:`);
    console.log(`   🔴 Bots ROUGES  : ${rougeBots.toLocaleString()}`);
    console.log(`   🔵 Bots BLEUS   : ${bleuBots.toLocaleString()}`);
    console.log(`   📊 Total ajouté : ${botsAdded.toLocaleString()}`);
    console.log(`   ⏱️  Durée        : ${duration.toFixed(2)}s`);
    console.log(`   🚀 Débit        : ${botsPerSecond.toLocaleString()} bots/s`);
    console.log(`\n💡 Les bots sont maintenant dans le lobby.`);
    console.log(`   Démarrez le jeu pour les voir cliquer automatiquement!`);
    console.log(`   Dashboard: http://localhost:3000\n`);

    // Fermer la connexion après un petit délai
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 500);
}

// Réception de messages (optionnel, pour debug)
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());

        // Afficher le premier lobby_update pour confirmation
        if (message.type === 'lobby_update' && botsAdded === 0) {
            console.log(`📊 Lobby actuel: ${message.players?.length || 0} joueurs déjà présents\n`);
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
    console.log(`\n\n🛑 Interruption...`);
    console.log(`📊 Bots ajoutés avant interruption: ${botsAdded.toLocaleString()}\n`);
    ws.close();
    process.exit(0);
});
