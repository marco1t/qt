# 📡 Epic 2 - Networking LAN : COMPLÉTÉE

## 🚀 État Global

| Story | Description | Statut | Date de fin |
|---|---|---|---|
| **2.1** | Network Module Foundation | ✅ Terminé | 2026-01-22 |
| **2.2** | Server Discovery | ✅ Terminé (Saisie Manuelle) | 2026-01-23 |
| **2.3** | Lobby System | ✅ Terminé (Sync Réseau) | 2026-01-23 |
| **2.4** | Game State Synchronization | ✅ Terminé | 2026-01-22 |
| **2.5** | Player Disconnection | ✅ Terminé (MVP) | 2026-01-23 |

---

## 🏗️ Architecture implémentée

**Serveur externe Node.js** + **Client WebSocket QML**

*   ✅ **Serveur Node.js** : Gère l'état du jeu (authoritative server), le lobby, et les bots.
*   ✅ **Client QML** : Se connecte via WebSocket, sync son état sur celui du serveur.
*   ✅ **Lobby Sync** : Les joueurs voient les mêmes infos (bots, équipes) en temps réel.
*   ✅ **Gameplay Sync** : Clics, jauges et victoire sont synchronisés.

---

## 📋 Comment jouer en Multijoueur LAN

### 1️⃣ Lancer le Serveur (Hôte)

Sur le PC de l'hôte (ou un serveur dédié) :

```bash
cd server
./start-server.sh
```
*Le serveur écoute sur le port 7777.*

### 2️⃣ Rejoindre la partie (Clients)

1.  Lancer ClickWars Territory sur chaque appareil.
2.  Cliquer sur **"Créer une partie"** (Hôte) ou **"Rejoindre"**.
3.  Entrer l'IP de l'ordinateur qui fait tourner le serveur.
4.  Attendre dans le **Lobby**.

### 3️⃣ Gérer le Lobby

*   **Ajouter des Bots** : L'hôte peut cliquer sur "🤖 Ajouter Bot".
*   **Synchronisation** : Tous les joueurs voient les bots apparaître instantanément.
*   **Lancer** : L'hôte clique sur "🚀 Lancer la partie".
*   **Démarrage** : Le jeu se lance automatiquement pour tout le monde.

---

## 📁 Structure des fichiers réseau

### Serveur (Node.js)
*   `server/GameServer.js` - Logique centrale (Lobby, Gameplay, Bots).
*   `server/websocket-server.js` - Gestion des connexions WS.

### Client (QML/JS)
*   `qml/components/NetworkManager.qml` - Couche communication.
*   `qml/components/GameStateManager.qml` - Sync local/réseau.
*   `qml/js/GameState.js` - Logique état local.
*   `qml/screens/LobbyScreen.qml` - Interface multijoueur.

---

## 🎉 Conclusion

L'infrastructure réseau est **robuste et complète** pour un jeu en LAN.
Le passage à une architecture Node.js externe a permis une séparation nette entre la logique serveur et l'interface client, facilitant le développement et le test (Felgo Hot Reload supporté à 100%).
