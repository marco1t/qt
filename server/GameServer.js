/**
 * GameServer.js - Logique de jeu côté serveur
 * 
 * Gère l'état autoritaire du jeu :
 * - Valide les clics des joueurs
 * - Maintient l'état des jauges
 * - Détecte les victoires
 * - Diffuse les mises à jour à tous les clients
 */

class GameServer {
    constructor() {
        // État du serveur
        this.state = {
            phase: "lobby",  // lobby | playing | victory
            teamA: {
                gauge: 0,
                players: []
            },
            teamB: {
                gauge: 0,
                players: []
            },
            config: {
                maxGauge: 100,
                territoryName: "Territoire 1"
            },
            winner: null
        };

        // Clients connectés
        this.clients = new Map();  // clientId -> { ws, playerIds: [], playerData: [] }

        // Throttling pour les broadcasts
        this.lastBroadcast = 0;
        this.BROADCAST_INTERVAL = 33; // ~30 FPS
        this.pendingBroadcast = null;

        // Bot Loop
        this.botInterval = null;
        this.BOT_CLICK_RATE_MS = 1000; // Chaque bot tente de cliquer toutes les X ms
    }

    /**
     * Ajoute un client connecté
     */
    addClient(clientId, ws) {
        this.clients.set(clientId, {
            ws: ws,
            playerIds: [],      // Liste des IDs de joueurs créés par ce client
            playerData: []      // Liste des données de joueurs
        });
        console.log(`✅ GameServer: Client ${clientId} ajouté`);
    }

    /**
     * Retire un client déconnecté
     */
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.playerIds.length > 0) {
            // Retirer TOUS les joueurs créés par ce client
            client.playerIds.forEach(playerId => {
                this.removePlayer(playerId);
                console.log(`👤 GameServer: Joueur ${playerId} retiré (client déconnecté)`);
            });
            this.broadcastStateUpdate();
        }
        this.clients.delete(clientId);
        console.log(`❌ GameServer: Client ${clientId} retiré`);
    }

    /**
     * Gère un message reçu d'un client
     */
    handleMessage(clientId, message) {
        const { type } = message;

        switch (type) {
            case "player_join":
                this.handlePlayerJoin(clientId, message);
                break;
            case "click":
                this.handleClick(clientId, message);
                break;
            case "start_game":
                this.handleStartGame(clientId, message);
                break;
            case "reset_game":
                this.handleResetGame(clientId, message);
                break;
            case "add_bot":
                this.handleAddBot(clientId, message);
                break;
            case "remove_bot":
                this.handleRemoveBot(clientId, message);
                break;
            case "update_config":
                this.handleUpdateConfig(clientId, message);
                break;
            default:
                console.warn(`⚠️  GameServer: Type de message inconnu: ${type}`);
        }
    }

    /**
     * Gère l'arrivée d'un joueur
     */
    handlePlayerJoin(clientId, message) {
        const { playerId, name } = message; // On ignore 'team' venant du client

        console.log(`📨 GameServer: Demande de join reçue pour ${name} (${clientId})`);

        // 1. Stratégie d'Auto-Équilibrage (Auto-Balance)
        // On compte les joueurs ACTIFS dans chaque équipe
        const countA = this.state.teamA.players.length;
        const countB = this.state.teamB.players.length;

        let assignedTeam = "A";

        // Logique : On remplit A, puis B, puis A, puis B...
        if (countA > countB) {
            assignedTeam = "B";
        } else if (countB > countA) {
            assignedTeam = "A";
        } else {
            // Égalité ? On alterne basé sur le nombre total (si pair -> A, impair -> B)
            // Ou plus simple : priorité à A par défaut s'il n'y a personne
            assignedTeam = "A";
        }

        console.log(`⚖️  Auto-Balance: A=${countA} vs B=${countB} -> Assignation ${assignedTeam}`);

        console.log(`👤 GameServer: Joueur VALIDÉ: ${name} -> Team ${assignedTeam}`);

        // Créer le joueur avec l'équipe imposée
        const playerData = {
            id: playerId,
            name: name || `Joueur ${countA + countB + 1}`,
            team: assignedTeam,
            score: 0,
            isBot: false,
            isBot: false,
            isHost: false, // Sera mis à jour si nécessaire
            clickHistory: [] // Historique des timestamps de clics
        };

        // Stocker dans le client (ajouter à la liste)
        const client = this.clients.get(clientId);
        if (client) {
            // Éviter les doublons
            if (!client.playerIds.includes(playerId)) {
                client.playerIds.push(playerId);
                client.playerData.push(playerData);
            }
        }

        // Ajouter à l'équipe
        this.addPlayer(playerData);

        // Broadcast l'état complet au nouveau joueur (pour qu'il sache qui il est)
        this.sendStateToClient(clientId);

        // Broadcast le lobby à tous les clients
        this.broadcastLobbyUpdate();

        // Broadcast de l'état global (pour mettre à jour les jauges/scores partout)
        this.broadcastStateUpdate();
    }

    /**
     * Gère un clic de joueur
     */
    handleClick(clientId, message) {
        const { playerId } = message;

        // Vérifier que le jeu est en cours
        if (this.state.phase !== "playing") {
            return;
        }

        // Trouver le joueur
        const player = this.getPlayer(playerId);
        if (!player) {
            console.warn(`⚠️  GameServer: Joueur ${playerId} non trouvé`);
            return;
        }

        // Vérifier si la jauge de son équipe est pleine
        const teamData = this.getTeamData(player.team);
        if (teamData.gauge >= this.state.config.maxGauge) {
            return; // Jauge pleine, ignorer le clic
        }

        // Incrémenter la jauge
        teamData.gauge++;

        // Incrémenter le score du joueur
        player.score++;
        player.clickHistory.push(Date.now());

        // Vérifier la victoire
        const winner = this.checkVictory();
        if (winner) {
            this.state.winner = winner;
            this.state.phase = "victory";
            this.broadcastVictory(winner);
        } else {
            this.broadcastStateUpdate();
        }
    }

    /**
     * Simule un clic de bot
     */
    simulateBotClicks() {
        if (this.state.phase !== "playing") return;

        this.getAllPlayers().forEach(player => {
            if (player.isBot) {
                // Probabilité de clic variable pour faire "vivant"
                if (Math.random() > 0.3) {
                    this.handleBotClick(player);
                }
            }
        });
    }

    handleBotClick(player) {
        // Vérifier si la jauge de son équipe est pleine
        const teamData = this.getTeamData(player.team);
        if (teamData.gauge >= this.state.config.maxGauge) return;

        // Incrémenter
        teamData.gauge++;
        player.score++;
        player.clickHistory.push(Date.now());

        // Vérifier victoire (rare que ce soit le bot qui gagne pile au tick, mais possible)
        const winner = this.checkVictory();
        if (winner) {
            this.state.winner = winner;
            this.state.phase = "victory";
            this.stopBotLoop();
            this.broadcastVictory(winner);
        } else {
            // On ne broadcast pas à chaque clic de bot pour ne pas spammer, 
            // le broadcastStateUpdate régulier s'en charge via le tick des vrais joueurs ou un intervalle
            this.broadcastStateUpdate();
        }
    }

    startBotLoop() {
        if (this.botInterval) clearInterval(this.botInterval);
        console.log("🤖 GameServer: Démarrage de l'IA");
        this.botInterval = setInterval(() => {
            this.simulateBotClicks();
        }, 500); // Check 2 fois par seconde
    }

    stopBotLoop() {
        if (this.botInterval) {
            clearInterval(this.botInterval);
            this.botInterval = null;
            console.log("🤖 GameServer: Arrêt de l'IA");
        }
    }

    /**
     * Démarre le jeu
     */
    handleStartGame(clientId, message) {
        console.log("🎮 GameServer: Démarrage du jeu");
        this.state.phase = "playing";
        this.state.teamA.gauge = 0;
        this.state.teamB.gauge = 0;
        this.state.winner = null;

        // Reset des scores
        this.getAllPlayers().forEach(player => {
            player.score = 0;
            player.clickHistory = [];
        });

        this.startBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Réinitialise le jeu
     */
    handleResetGame(clientId, message) {
        console.log("🔄 GameServer: Reset du jeu");
        this.state.phase = "lobby";
        this.state.teamA.gauge = 0;
        this.state.teamB.gauge = 0;
        this.state.winner = null;

        // Reset des scores
        this.getAllPlayers().forEach(player => {
            player.score = 0;
            player.clickHistory = [];
        });

        this.stopBotLoop();
        this.broadcastStateUpdate();
    }

    /**
     * Ajoute un joueur à l'équipe
     */
    addPlayer(playerData) {
        const teamData = this.getTeamData(playerData.team);

        // Vérifier si le joueur existe déjà
        const existingIndex = teamData.players.findIndex(p => p.id === playerData.id);
        if (existingIndex >= 0) {
            teamData.players[existingIndex] = playerData;
        } else {
            teamData.players.push(playerData);
        }
    }

    /**
     * Retire un joueur
     */
    removePlayer(playerId) {
        // Chercher dans les deux équipes
        this.state.teamA.players = this.state.teamA.players.filter(p => p.id !== playerId);
        this.state.teamB.players = this.state.teamB.players.filter(p => p.id !== playerId);
    }

    /**
     * Retourne un joueur par ID
     */
    getPlayer(playerId) {
        const all = this.getAllPlayers();
        return all.find(p => p.id === playerId) || null;
    }

    /**
     * Retourne tous les joueurs
     */
    getAllPlayers() {
        return [...this.state.teamA.players, ...this.state.teamB.players];
    }

    /**
     * Retourne les données d'une équipe
     */
    getTeamData(team) {
        return team === "A" ? this.state.teamA : this.state.teamB;
    }

    /**
     * Vérifie si une équipe a gagné
     */
    checkVictory() {
        if (this.state.teamA.gauge >= this.state.config.maxGauge) {
            return "A";
        }
        if (this.state.teamB.gauge >= this.state.config.maxGauge) {
            return "B";
        }
        return null;
    }

    /**
     * Envoie l'état complet à un client spécifique
     */
    sendStateToClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.ws) return;

        const message = {
            type: "state_update",
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            players: this.getAllPlayers(),
            phase: this.state.phase,
            timestamp: Date.now()
        };

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi à ${clientId}:`, error.message);
        }
    }

    /**
     * Diffuse une mise à jour d'état à tous les clients (avec throttling)
     */
    broadcastStateUpdate() {
        const now = Date.now();

        // Throttling : max 30 updates/seconde
        if (now - this.lastBroadcast < this.BROADCAST_INTERVAL) {
            if (!this.pendingBroadcast) {
                this.pendingBroadcast = setTimeout(() => {
                    this.pendingBroadcast = null;
                    this.broadcastStateUpdate();
                }, this.BROADCAST_INTERVAL);
            }
            return;
        }

        this.lastBroadcast = now;
        this.pendingBroadcast = null;

        const message = {
            type: "state_update",
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            maxGauge: this.state.config.maxGauge,
            players: this.getAllPlayers(),
            phase: this.state.phase,
            timestamp: now
        };

        this.broadcast(message);
    }

    /**
     * Diffuse la victoire à tous les clients
     */
    broadcastVictory(winner) {
        console.log(`🏆 GameServer: Victoire équipe ${winner}!`);

        const message = {
            type: "victory",
            winner: winner,
            finalScores: this.getAllPlayers(),
            timestamp: Date.now()
        };

        this.broadcast(message);
    }

    /**
     * Diffuse l'état du lobby à tous les clients
     */
    broadcastLobbyUpdate() {
        const message = {
            type: "lobby_update",
            players: this.getAllPlayers(),
            phase: this.state.phase,
            maxGauge: this.state.config.maxGauge, // Envoyer la config actuelle
            timestamp: Date.now()
        };

        console.log(`📝 Lobby broadcast: ${this.getAllPlayers().length} joueurs`);
        this.broadcast(message);
    }

    /**
     * Gère l'ajout d'un bot par l'hôte
     */
    handleAddBot(clientId, message) {
        const { team, name } = message;

        // Vérifier qu'on n'a pas trop de joueurs
        // if (this.getAllPlayers().length >= 4) {
        //    console.warn("⚠️  GameServer: Lobby plein, impossible d'ajouter un bot");
        //    return;
        // } -- LIMIT REMOVED

        const botId = "bot_" + Date.now();
        const botName = name || "Bot " + (this.getAllPlayers().length + 1);
        const botTeam = team || (this.state.teamA.players.length <= this.state.teamB.players.length ? "A" : "B");

        const botData = {
            id: botId,
            name: botName,
            team: botTeam,
            score: 0,
            isBot: true,
            isBot: true,
            isHost: false,
            clickHistory: []
        };

        this.addPlayer(botData);
        console.log(`🤖 GameServer: Bot ajouté: ${botName} (Team ${botTeam})`);

        this.broadcastLobbyUpdate();
    }

    /**
     * Gère le retrait d'un bot
     */
    handleRemoveBot(clientId, message) {
        const { botId } = message;

        const player = this.getPlayer(botId);
        if (!player || !player.isBot) {
            console.warn(`⚠️  GameServer: Bot ${botId} non trouvé`);
            return;
        }

        this.removePlayer(botId);
        console.log(`🤖 GameServer: Bot retiré: ${player.name}`);

        this.broadcastLobbyUpdate();
    }

    /**
     * Gère la mise à jour de la configuration (Objectif de clics)
     */
    handleUpdateConfig(clientId, message) {
        const { maxGauge } = message;

        if (!maxGauge || maxGauge < 10) {
            return; // Ignorer valeurs invalides
        }

        console.log(`⚙️  GameServer: Config mise à jour: Objectif = ${maxGauge}`);
        this.state.config.maxGauge = maxGauge;

        // Diffuser à tout le monde
        this.broadcastLobbyUpdate();
        this.broadcastStateUpdate();
    }

    /**
     * Envoie un message à tous les clients connectés
     */
    broadcast(message) {
        const json = JSON.stringify(message);
        let sentCount = 0;

        this.clients.forEach((client, clientId) => {
            try {
                if (client.ws && client.ws.readyState === 1) { // OPEN
                    client.ws.send(json);
                    sentCount++;
                }
            } catch (error) {
                console.error(`❌ Erreur broadcast à ${clientId}:`, error.message);
            }
        });

        // console.log(`📡 Broadcast ${message.type} à ${sentCount} clients`);
    }

    /**
     * Retourne les statistiques du serveur
     */
    getStats() {
        return {
            phase: this.state.phase,
            clients: this.clients.size,
            players: this.getAllPlayers().length,
            teamAGauge: this.state.teamA.gauge,
            teamAGauge: this.state.teamA.gauge,
            teamBGauge: this.state.teamB.gauge,
            playersList: this.getAllPlayers()
        };
    }
}

module.exports = GameServer;
