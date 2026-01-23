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
        this.clients = new Map();  // clientId -> { ws, playerId, playerData }

        // Throttling pour les broadcasts
        this.lastBroadcast = 0;
        this.BROADCAST_INTERVAL = 33; // ~30 FPS
        this.pendingBroadcast = null;
    }

    /**
     * Ajoute un client connecté
     */
    addClient(clientId, ws) {
        this.clients.set(clientId, {
            ws: ws,
            playerId: null,
            playerData: null
        });
        console.log(`✅ GameServer: Client ${clientId} ajouté`);
    }

    /**
     * Retire un client déconnecté
     */
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.playerId) {
            // Retirer le joueur de l'équipe
            this.removePlayer(client.playerId);
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
            default:
                console.warn(`⚠️  GameServer: Type de message inconnu: ${type}`);
        }
    }

    /**
     * Gère l'arrivée d'un joueur
     */
    handlePlayerJoin(clientId, message) {
        const { playerId, name, team } = message;

        console.log(`👤 GameServer: Joueur rejoint: ${name} (Team ${team})`);

        // Créer le joueur
        const playerData = {
            id: playerId,
            name: name || "Player",
            team: team,
            score: 0,
            isBot: false,
            isHost: false
        };

        // Stocker dans le client
        const client = this.clients.get(clientId);
        if (client) {
            client.playerId = playerId;
            client.playerData = playerData;
        }

        // Ajouter à l'équipe
        this.addPlayer(playerData);

        // Broadcast l'état complet au nouveau joueur
        this.sendStateToClient(clientId);

        // Broadcast aux autres qu'un joueur a rejoint
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
        });

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
        });

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
            teamBGauge: this.state.teamB.gauge
        };
    }
}

module.exports = GameServer;
