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

Appuyez sur **Ctrl+C** dans le terminal.

---

## 🤖 Simulateur de Clics (Test de Performance)

Le script `simulate-clicks.js` permet de simuler des clics de bots pour tester la performance du jeu sous charge.

### Installation

Les dépendances sont déjà installées avec `npm install` (utilise le même `ws` que le serveur).

### Usage de base

```bash
node simulate-clicks.js [equipe] [nombre_clics] [port]
```

**Arguments:**
- `equipe` - Équipe cible: `rouge`/`bleu` ou `A`/`B` (obligatoire)
- `nombre_clics` - Nombre de clics à simuler (défaut: 100)
- `port` - Port du serveur WebSocket (défaut: 7777)

### Exemples

**Tester avec 10,000 clics pour l'équipe bleue:**
```bash
node simulate-clicks.js bleu 10000
```

**Tester avec 5,000 clics pour l'équipe rouge:**
```bash
node simulate-clicks.js rouge 5000
```

**Utiliser un port personnalisé:**
```bash
node simulate-clicks.js A 1000 8888
```

**Afficher l'aide:**
```bash
node simulate-clicks.js --help
```

### Scénario de test typique

1. **Lancer le serveur** dans un terminal:
   ```bash
   cd server
   npm start
   ```

2. **Lancer le jeu** et démarrer une partie

3. **Pendant que la partie est en cours**, ouvrir un **nouveau terminal** et simuler des clics:
   ```bash
   cd server
   node simulate-clicks.js bleu 10000
   ```

4. **Observer** le comportement du jeu:
   - La jauge bleue devrait monter rapidement
   - Vérifier s'il y a des ralentissements
   - Observer les logs du serveur pour détecter les erreurs

### Fonctionnalités

- ✅ Connexion automatique au serveur
- ✅ Enregistrement comme bot joueur
- ✅ Envoi massif de clics par paquets
- ✅ Barre de progression en temps réel
- ✅ Statistiques de performance (clics/seconde)
- ✅ Support interruption (Ctrl+C)
- ✅ Messages d'erreur détaillés

### Notes importantes

- Le serveur **doit être en cours d'exécution**
- Le jeu doit être en phase **"playing"** pour que les clics comptent
- Les clics sont envoyés par paquets de 100 toutes les 10ms
- Le script se déconnecte automatiquement après l'envoi

