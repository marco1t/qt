# ClickWars Territory - WebSocket Server

Serveur WebSocket pour le mode multijoueur de ClickWars Territory.

## 🚀 Démarrage rapide

### 1. Installer les dépendances (première fois seulement)

```bash
cd server
npm install
```

### 2. Lancer le serveur

```bash
npm start
```

Ou avec un port personnalisé :

```bash
node websocket-server.js 8888
```

## 📡 Utilisation

1. **Lancer le serveur** dans un terminal
2. **Lancer le jeu** ClickWars Territory
3. Dans le jeu, aller sur **"Test Réseau"**
4. **Mode Serveur** : Pas besoin, le serveur Node.js le fait !
5. **Mode Client** : Se connecter à `127.0.0.1:7777`

## 🔧 Configuration

- **Port par défaut** : 7777
- **Host** : 0.0.0.0 (accessible en LAN)

## 📝 Logs

Le serveur affiche :
- ✅ Connexions/déconnexions de clients
- 📨 Messages reçus et relayés
- ❌ Erreurs éventuelles

## 🛑 Arrêter le serveur

Appuyez sur **Ctrl+C** dans le terminal.
