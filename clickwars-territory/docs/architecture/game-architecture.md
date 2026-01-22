# ClickWars: Territory - Game Architecture Document

**Document Version:** 1.0  
**Date:** 2026-01-22  
**Status:** Draft  
**Author:** Winston - Solution Architect (B-MAD)

---

## 1. Introduction

Ce document décrit l'architecture technique complète de **ClickWars: Territory**, un jeu multijoueur local (LAN) développé avec Qt 6.8.3 et Felgo 4.0. Il sert de fondation technique pour tout le développement, assurant cohérence, maintenabilité et performance.

L'architecture est conçue pour supporter :
- 4 joueurs simultanés en réseau local
- Synchronisation en temps réel des jauges (< 50ms de latence)
- 60 FPS constants avec effets visuels
- Compatibilité cross-platform (Windows, macOS, Linux)

### 1.1 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-22 | 1.0 | Création initiale | Winston (Architect) |

---

## 2. Technical Overview

### 2.1 Architecture Summary

L'application adopte une architecture **Client-Serveur avec Hôte Autoritaire** :

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARCHITECTURE GLOBALE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     LAN      ┌─────────────┐                  │
│   │   CLIENT    │◄────────────►│   CLIENT    │                  │
│   │  (Player 2) │              │  (Player 3) │                  │
│   └──────┬──────┘              └──────┬──────┘                  │
│          │                            │                          │
│          │         TCP/UDP            │                          │
│          │                            │                          │
│          ▼                            ▼                          │
│   ┌────────────────────────────────────────────┐                │
│   │              HOST / SERVER                  │                │
│   │            (Player 1 - Autorité)            │                │
│   ├────────────────────────────────────────────┤                │
│   │  GameState │ NetworkServer │ BotManager    │                │
│   └────────────────────────────────────────────┘                │
│          ▲                                                       │
│          │                                                       │
│   ┌──────┴──────┐                                               │
│   │   CLIENT    │                                               │
│   │  (Player 4) │                                               │
│   └─────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Principes clés :**
- **Hôte Autoritaire** : Le serveur (premier joueur) valide tous les clics et gère l'état du jeu
- **Clients Légers** : Les clients envoient des actions et reçoivent l'état synchronisé
- **Découverte Automatique** : UDP Broadcast pour trouver les parties sur le LAN
- **Communication Fiable** : TCP pour les actions (clics) et mises à jour d'état

### 2.2 Platform Targets

| Plateforme | Support | Notes |
|------------|---------|-------|
| **Windows 10+** | ✅ Primaire | Testé en priorité |
| **macOS 11+** | ✅ Primaire | Apple Silicon (M1/M4) compatible |
| **Linux Ubuntu 20.04+** | ✅ Secondaire | AppImage ou binaire |

**Spécifications Minimum :**
- CPU : 2 cores, 1.5 GHz
- RAM : 4 GB (< 200MB utilisés par le jeu)
- Réseau : Connexion LAN (Ethernet ou WiFi)
- Écran : 1280x720 minimum

**Performance Cible :** 60 FPS constant sur toutes les plateformes

### 2.3 Technology Stack

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| **Framework UI** | Felgo | 4.0 (Qt 6 branch) | Interface, animations, particules |
| **Core Framework** | Qt | 6.8.3 | Base cross-platform |
| **Langage UI** | QML | Qt 6 syntax | Composants visuels |
| **Logique** | JavaScript | ES6+ | Règles du jeu, état, IA |
| **Réseau** | Qt.Network (QML) | - | TCP/UDP natif QML |
| **Build** | qmake + Makefile | - | Compilation cross-platform |
| **Tests** | Qt Test + QML TestCase | - | Tests unitaires et intégration |

**Dépendances externes : AUCUNE** - Tout est fourni par Qt/Felgo

---

## 3. Project Structure

### 3.1 Repository Organization

```
clickwars-territory/
├── Makefile                    # Build system principal
├── clickwars-territory.pro     # Fichier projet qmake
├── README.md                   # Documentation principale
├── .gitignore                  # Fichiers ignorés
│
├── src/
│   ├── main.qml               # Point d'entrée QML
│   ├── Main.cpp               # Point d'entrée C++ (minimal)
│   │
│   ├── qml/
│   │   ├── screens/           # Écrans principaux
│   │   │   ├── MainMenuScreen.qml
│   │   │   ├── LobbyScreen.qml
│   │   │   ├── GameScreen.qml
│   │   │   ├── VictoryScreen.qml
│   │   │   └── ServerBrowserScreen.qml
│   │   │
│   │   ├── components/        # Composants réutilisables
│   │   │   ├── GaugeBar.qml
│   │   │   ├── ClickZone.qml
│   │   │   ├── PlayerSlot.qml
│   │   │   ├── ParticleEffect.qml
│   │   │   └── AnimatedButton.qml
│   │   │
│   │   ├── overlays/          # Overlays et modals
│   │   │   ├── VictoryOverlay.qml
│   │   │   └── DisconnectOverlay.qml
│   │   │
│   │   └── styles/            # Styles et thèmes
│   │       └── Theme.qml
│   │
│   ├── js/
│   │   ├── GameState.js       # État global du jeu
│   │   ├── NetworkManager.js  # Gestion réseau
│   │   ├── BotManager.js      # Gestion des bots IA
│   │   ├── GameLogic.js       # Règles du jeu
│   │   └── Utils.js           # Utilitaires
│   │
│   └── assets/
│       ├── images/            # Sprites, icônes
│       ├── sounds/            # Sons et musique
│       └── fonts/             # Polices personnalisées
│
├── tests/
│   ├── unit/
│   │   ├── tst_gamestate.qml
│   │   ├── tst_gamelogic.qml
│   │   └── tst_botmanager.qml
│   │
│   └── integration/
│       ├── tst_network.qml
│       └── tst_synchronization.qml
│
└── docs/
    ├── design/
    │   └── game-brief.md
    ├── architecture/
    │   └── game-architecture.md
    ├── prd.md
    └── brainstorming-session-results.md
```

### 3.2 Module Organization

#### 3.2.1 Screen Pattern

Chaque écran suit ce pattern :

```qml
// screens/ExampleScreen.qml
import Felgo
import QtQuick
import "../components"
import "../js/GameState.js" as GameState

Scene {
    id: exampleScreen
    
    // État local de l'écran
    property bool isLoading: false
    
    // Signaux pour la navigation
    signal navigateTo(string screenName)
    
    // Initialisation
    Component.onCompleted: {
        // Setup
    }
    
    // Cleanup
    Component.onDestruction: {
        // Cleanup
    }
    
    // Contenu UI
    Column {
        // ...
    }
}
```

#### 3.2.2 Component Pattern

Les composants réutilisables suivent ce pattern :

```qml
// components/ExampleComponent.qml
import QtQuick
import Felgo

Item {
    id: root
    
    // Propriétés publiques
    property color teamColor: "#E74C3C"
    property real value: 0
    property real maxValue: 100
    
    // Signaux
    signal clicked()
    signal valueChanged(real newValue)
    
    // Implémentation
    Rectangle {
        // ...
    }
}
```

#### 3.2.3 JavaScript Module Pattern

Les modules JavaScript suivent ce pattern :

```javascript
// js/ExampleModule.js
.pragma library  // Singleton partagé entre tous les QML

// État privé
var _privateState = {};

// Fonctions publiques
function initialize() { }
function getState() { return _privateState; }
function setState(newState) { _privateState = newState; }

// Fonctions privées
function _helperFunction() { }
```

---

## 4. Core Game Systems

### 4.1 Game State Management System

**Fichier principal :** `src/js/GameState.js`

**Responsabilités :**
- Maintenir l'état global du jeu
- Notifier les changements via signals QML
- Gérer les transitions de phase

**Structure de l'état :**

```javascript
// GameState.js
.pragma library

var state = {
    // Phase du jeu
    phase: "menu",  // menu | lobby | playing | victory
    
    // Jauges d'équipe
    teamA: {
        gauge: 0,
        players: []
    },
    teamB: {
        gauge: 0,
        players: []
    },
    
    // Joueur local
    localPlayer: {
        id: null,
        name: "Player",
        team: null,
        score: 0,
        isHost: false
    },
    
    // Configuration de partie
    config: {
        maxGauge: 100,
        territoryName: "Territoire 1"
    },
    
    // Réseau
    network: {
        isConnected: false,
        serverIp: null,
        players: []
    }
};

// Listeners pour les changements
var _listeners = [];

function subscribe(callback) {
    _listeners.push(callback);
}

function notify() {
    _listeners.forEach(function(cb) { cb(state); });
}

function incrementGauge(team) {
    if (team === "A" && state.teamA.gauge < state.config.maxGauge) {
        state.teamA.gauge++;
        notify();
        return true;  // Clic valide
    } else if (team === "B" && state.teamB.gauge < state.config.maxGauge) {
        state.teamB.gauge++;
        notify();
        return true;
    }
    return false;  // Jauge pleine
}

function checkVictory() {
    if (state.teamA.gauge >= state.config.maxGauge) {
        return "A";
    } else if (state.teamB.gauge >= state.config.maxGauge) {
        return "B";
    }
    return null;
}

function resetGame() {
    state.teamA.gauge = 0;
    state.teamB.gauge = 0;
    state.phase = "playing";
    notify();
}
```

**Diagramme de flux d'état :**

```
    ┌───────┐
    │ MENU  │
    └───┬───┘
        │ createGame() / joinGame()
        ▼
    ┌───────┐
    │ LOBBY │◄──── Joueurs rejoignent
    └───┬───┘
        │ startGame()
        ▼
    ┌─────────┐
    │ PLAYING │◄──── Clics → incrementGauge()
    └────┬────┘
         │ gauge >= 100
         ▼
    ┌─────────┐
    │ VICTORY │
    └────┬────┘
         │ playAgain()
         ▼
    ┌─────────┐
    │ PLAYING │ (ou retour MENU)
    └─────────┘
```

### 4.2 Network Management System

**Fichier principal :** `src/js/NetworkManager.js`

**Responsabilités :**
- Gérer les connexions TCP (client/serveur)
- Émettre/recevoir les broadcasts UDP pour la découverte
- Sérialiser/désérialiser les messages JSON

**Architecture réseau :**

```
┌─────────────────────────────────────────────────────────────┐
│                    PROTOCOLE RÉSEAU                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  UDP (Port 7778) - DISCOVERY                                │
│  ────────────────────────────                               │
│  Server → Broadcast (2s interval)                           │
│  {                                                          │
│    "type": "server_announce",                               │
│    "name": "Partie de Player1",                             │
│    "players": 2,                                            │
│    "maxPlayers": 4,                                         │
│    "port": 7777                                             │
│  }                                                          │
│                                                              │
│  TCP (Port 7777) - GAME COMMUNICATION                       │
│  ─────────────────────────────────────                      │
│                                                              │
│  Client → Server:                                           │
│  { "type": "click", "playerId": "p2" }                      │
│  { "type": "join", "name": "Player2" }                      │
│  { "type": "leave" }                                        │
│                                                              │
│  Server → Clients:                                          │
│  {                                                          │
│    "type": "state_update",                                  │
│    "teamAGauge": 45,                                        │
│    "teamBGauge": 38,                                        │
│    "players": [...],                                        │
│    "phase": "playing"                                       │
│  }                                                          │
│  { "type": "victory", "winner": "A" }                       │
│  { "type": "player_joined", "player": {...} }               │
│  { "type": "player_left", "playerId": "p2" }                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implémentation QML/JS :**

```qml
// NetworkComponent.qml (intégré dans main.qml)
import QtQuick
import Felgo

Item {
    id: networkManager
    
    // Propriétés
    property bool isServer: false
    property bool isConnected: false
    property string serverAddress: ""
    property int serverPort: 7777
    property int discoveryPort: 7778
    
    // Signaux
    signal messageReceived(var message)
    signal clientConnected(string clientId)
    signal clientDisconnected(string clientId)
    signal serverDiscovered(string ip, string name, int players)
    
    // Serveur TCP
    TcpServer {
        id: tcpServer
        port: serverPort
        
        onNewConnection: function(socket) {
            clientConnected(socket.peerAddress)
            // Gérer le nouveau client
        }
    }
    
    // Socket Client TCP
    TcpSocket {
        id: tcpClient
        
        onConnected: {
            isConnected = true
        }
        
        onMessageReceived: function(message) {
            var data = JSON.parse(message)
            messageReceived(data)
        }
    }
    
    // UDP pour discovery
    UdpSocket {
        id: udpSocket
        port: discoveryPort
        
        onDatagramReceived: function(data, host, port) {
            var msg = JSON.parse(data)
            if (msg.type === "server_announce") {
                serverDiscovered(host, msg.name, msg.players)
            }
        }
    }
    
    // Fonctions publiques
    function startServer(gameName) {
        isServer = true
        tcpServer.start()
        // Démarrer le broadcast UDP
        startBroadcast(gameName)
    }
    
    function connectToServer(ip) {
        tcpClient.connectToHost(ip, serverPort)
    }
    
    function sendMessage(msg) {
        var json = JSON.stringify(msg)
        if (isServer) {
            tcpServer.sendToAll(json)
        } else {
            tcpClient.send(json)
        }
    }
    
    function sendClick() {
        sendMessage({ type: "click", playerId: GameState.state.localPlayer.id })
    }
}
```

### 4.3 Bot AI System

**Fichier principal :** `src/js/BotManager.js`

**Responsabilités :**
- Simuler des clics automatiques à intervalles variables
- Gérer plusieurs bots avec des vitesses différentes
- Intégrer les bots comme "joueurs virtuels"

**Niveaux de difficulté :**

| Niveau | Clics/seconde | Intervalle (ms) |
|--------|---------------|-----------------|
| Easy | 2-3 | 333-500 |
| Normal | 4-5 | 200-250 |
| Hard | 6-8 | 125-167 |

**Implémentation :**

```javascript
// BotManager.js
.pragma library

var _bots = [];
var _botIdCounter = 0;

var DIFFICULTY = {
    easy: { minInterval: 333, maxInterval: 500 },
    normal: { minInterval: 200, maxInterval: 250 },
    hard: { minInterval: 125, maxInterval: 167 }
};

function createBot(team, difficulty) {
    var bot = {
        id: "bot_" + (++_botIdCounter),
        name: "Bot " + _botIdCounter,
        team: team,
        difficulty: difficulty,
        timerId: null,
        isActive: false
    };
    _bots.push(bot);
    return bot;
}

function startBot(botId, clickCallback) {
    var bot = _bots.find(function(b) { return b.id === botId; });
    if (!bot) return;
    
    bot.isActive = true;
    scheduleNextClick(bot, clickCallback);
}

function scheduleNextClick(bot, clickCallback) {
    if (!bot.isActive) return;
    
    var config = DIFFICULTY[bot.difficulty];
    var interval = config.minInterval + 
        Math.random() * (config.maxInterval - config.minInterval);
    
    bot.timerId = Qt.setTimeout(function() {
        if (bot.isActive) {
            clickCallback(bot.team, bot.id);
            scheduleNextClick(bot, clickCallback);
        }
    }, interval);
}

function stopBot(botId) {
    var bot = _bots.find(function(b) { return b.id === botId; });
    if (!bot) return;
    
    bot.isActive = false;
    if (bot.timerId) {
        Qt.clearTimeout(bot.timerId);
        bot.timerId = null;
    }
}

function stopAllBots() {
    _bots.forEach(function(bot) { stopBot(bot.id); });
}

function removeBot(botId) {
    stopBot(botId);
    _bots = _bots.filter(function(b) { return b.id !== botId; });
}

function getActiveBots() {
    return _bots.filter(function(b) { return b.isActive; });
}
```

### 4.4 UI Component System

**Architecture des composants visuels :**

```
┌─────────────────────────────────────────────────────────────┐
│                    HIÉRARCHIE UI                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GameWindow (Felgo)                                          │
│  └── StackView (Navigation)                                  │
│      ├── MainMenuScreen                                      │
│      │   ├── AnimatedButton "Créer Partie"                  │
│      │   ├── AnimatedButton "Rejoindre"                      │
│      │   └── AnimatedButton "Quitter"                        │
│      │                                                       │
│      ├── LobbyScreen                                         │
│      │   ├── PlayerSlot x4 (Grid 2x2)                       │
│      │   ├── TeamLabel x2                                    │
│      │   └── AnimatedButton "Lancer" (host only)            │
│      │                                                       │
│      ├── GameScreen                                          │
│      │   ├── GaugeBar (Team A) ─────────────────┐           │
│      │   ├── TerritoryLabel                     │ Zone      │
│      │   ├── GaugeBar (Team B) ─────────────────┤ Bataille  │
│      │   ├── ClickZone (Interactive)            │           │
│      │   ├── ScoreDisplay                       │           │
│      │   ├── ParticleEffect (overlay)───────────┘           │
│      │   └── VictoryOverlay (conditionnel)                  │
│      │                                                       │
│      └── ServerBrowserScreen                                 │
│          └── ListView (ServerItem repeater)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Component Specifications

### 5.1 GaugeBar Component

**Fichier :** `src/qml/components/GaugeBar.qml`

```qml
import QtQuick
import QtQuick.Effects

Item {
    id: gaugeBar
    
    // Propriétés
    property real value: 0
    property real maxValue: 100
    property color teamColor: "#E74C3C"
    property string teamName: "Team A"
    property bool isDanger: value >= 80
    
    // Dimensions recommandées
    width: parent.width * 0.8
    height: 60
    
    // Fond de la jauge
    Rectangle {
        id: background
        anchors.fill: parent
        color: "#2C3E50"
        radius: height / 2
        
        // Remplissage animé
        Rectangle {
            id: fill
            width: parent.width * (gaugeBar.value / gaugeBar.maxValue)
            height: parent.height
            radius: parent.radius
            color: gaugeBar.teamColor
            
            // Animation fluide
            Behavior on width {
                NumberAnimation {
                    duration: 150
                    easing.type: Easing.OutQuad
                }
            }
            
            // Pulsation en zone danger
            SequentialAnimation on opacity {
                running: gaugeBar.isDanger
                loops: Animation.Infinite
                NumberAnimation { to: 0.7; duration: 200 }
                NumberAnimation { to: 1.0; duration: 200 }
            }
        }
    }
    
    // Texte du score
    Text {
        anchors.centerIn: parent
        text: Math.floor(gaugeBar.value) + "/" + Math.floor(gaugeBar.maxValue)
        color: "white"
        font.pixelSize: 24
        font.bold: true
    }
    
    // Label équipe
    Text {
        anchors.bottom: parent.top
        anchors.bottomMargin: 8
        anchors.horizontalCenter: parent.horizontalCenter
        text: gaugeBar.teamName
        color: gaugeBar.teamColor
        font.pixelSize: 18
    }
}
```

### 5.2 ClickZone Component

**Fichier :** `src/qml/components/ClickZone.qml`

```qml
import QtQuick

Rectangle {
    id: clickZone
    
    // Propriétés
    property color teamColor: "#E74C3C"
    property bool enabled: true
    
    // Signaux
    signal clicked(real x, real y)
    
    // Apparence
    width: 200
    height: 200
    radius: width / 2
    color: Qt.lighter(teamColor, 1.2)
    border.color: teamColor
    border.width: 4
    
    // État
    scale: 1.0
    
    // Texte
    Text {
        anchors.centerIn: parent
        text: "CLIQUEZ!"
        color: "white"
        font.pixelSize: 24
        font.bold: true
    }
    
    // Zone cliquable
    MouseArea {
        anchors.fill: parent
        enabled: clickZone.enabled
        
        onPressed: function(mouse) {
            bounceAnimation.start()
            clickZone.clicked(mouse.x, mouse.y)
        }
    }
    
    // Animation de rebond
    SequentialAnimation {
        id: bounceAnimation
        
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.15
            duration: 50
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.0
            duration: 100
            easing.type: Easing.InOutQuad
        }
    }
}
```

### 5.3 ParticleEffect Component

**Fichier :** `src/qml/components/ParticleEffect.qml`

```qml
import QtQuick
import QtQuick.Particles

Item {
    id: particleEffect
    
    // Propriétés
    property color particleColor: "#E74C3C"
    property real emitX: width / 2
    property real emitY: height / 2
    
    anchors.fill: parent
    
    // Système de particules
    ParticleSystem {
        id: particleSystem
        running: true
    }
    
    // Émetteur
    Emitter {
        id: emitter
        system: particleSystem
        x: particleEffect.emitX
        y: particleEffect.emitY
        
        emitRate: 0  // Contrôlé manuellement
        lifeSpan: 500
        lifeSpanVariation: 100
        
        velocity: AngleDirection {
            angle: 0
            angleVariation: 360
            magnitude: 150
            magnitudeVariation: 50
        }
        
        size: 12
        sizeVariation: 4
        endSize: 0
    }
    
    // Rendu des particules
    ImageParticle {
        system: particleSystem
        source: "qrc:///particlewhite.png"  // ou forme QML
        color: particleEffect.particleColor
        colorVariation: 0.2
        alpha: 0.8
    }
    
    // Fonction pour émettre une rafale
    function burst(x, y, count) {
        emitter.x = x
        emitter.y = y
        emitter.burst(count || 15)
    }
}
```

---

## 6. Network Protocol Specification

### 6.1 Message Types

#### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `join` | `{ name: string }` | Demande de rejoindre la partie |
| `click` | `{ playerId: string }` | Notification de clic |
| `leave` | `{}` | Déconnexion volontaire |
| `team_change` | `{ team: "A" \| "B" }` | Demande de changement d'équipe |

#### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `welcome` | `{ playerId, players[], team }` | Confirmation de connexion |
| `state_update` | `{ teamAGauge, teamBGauge, players[] }` | Mise à jour de l'état |
| `game_start` | `{ territoryName }` | Début de la partie |
| `victory` | `{ winner: "A" \| "B", scores[] }` | Fin de bataille |
| `player_joined` | `{ player: PlayerInfo }` | Nouveau joueur |
| `player_left` | `{ playerId }` | Joueur déconnecté |
| `error` | `{ message }` | Erreur |

### 6.2 State Synchronization Flow

```
Temps ──────────────────────────────────────────────────────────►

Client 1 (Host)     Server Logic       Client 2       Client 3
     │                   │                 │              │
     │ ◄─ startGame() ── │                 │              │
     │                   │                 │              │
     │                   │ ── game_start ─►│              │
     │                   │ ── game_start ──────────────► │
     │                   │                 │              │
     │ ── click ───────► │                 │              │
     │                   │ [validate]      │              │
     │                   │ [increment A]   │              │
     │                   │                 │              │
     │ ◄─ state_update ─ │ ─ state_update ►│              │
     │                   │ ── state_update ─────────────►│
     │                   │                 │              │
     │                   │                 │ ── click ──► │
     │                   │ ◄────────────── click ─────── │
     │                   │ [validate]      │              │
     │                   │ [increment B]   │              │
     │                   │                 │              │
     │ ◄─ state_update ─ │ ─ state_update ►│              │
     │                   │ ── state_update ─────────────►│
```

### 6.3 Network Error Handling

| Scénario | Détection | Action |
|----------|-----------|--------|
| Client timeout | 3s sans heartbeat | Remplacer par bot, notifier autres |
| Host disconnect | Connexion TCP fermée | Clients → Menu avec message |
| Message invalide | JSON parse fail | Ignorer le message, log erreur |
| Partie pleine | 4 joueurs atteints | Refuser connexion, envoyer erreur |

---

## 7. Performance Architecture

### 7.1 Performance Targets

| Métrique | Cible | Mesure |
|----------|-------|--------|
| **FPS** | 60 constant | Felgo PerformanceWidget |
| **Latence réseau** | < 50ms | Timestamp messages |
| **Mémoire RAM** | < 200MB | Profiler Qt |
| **Temps démarrage** | < 3s | Mesure manuelle |
| **Particules max** | 100 simultanées | Sans drop FPS |

### 7.2 Optimization Strategies

#### Rendering Optimization

```qml
// Utiliser layer.enabled pour les éléments statiques
Rectangle {
    layer.enabled: true  // Rasterise le contenu
    layer.smooth: true
    // Contenu qui ne change pas souvent
}

// Limiter les particules actives
ParticleEmitter {
    maximumEmitted: 100  // Cap global
}
```

#### Network Optimization

```javascript
// Throttle les state_update (max 30/seconde)
var _lastUpdate = 0;
var UPDATE_INTERVAL = 33;  // ~30 FPS

function broadcastState() {
    var now = Date.now();
    if (now - _lastUpdate < UPDATE_INTERVAL) return;
    _lastUpdate = now;
    
    _server.sendToAll(JSON.stringify({
        type: "state_update",
        teamAGauge: GameState.state.teamA.gauge,
        teamBGauge: GameState.state.teamB.gauge
    }));
}
```

#### Memory Management

- Réutiliser les objets particules (object pooling natif QML)
- Détruire les composants non visibles
- Limiter les images en mémoire

---

## 8. Configuration System

### 8.1 Theme Configuration

**Fichier :** `src/qml/styles/Theme.qml`

```qml
pragma Singleton
import QtQuick

QtObject {
    // Couleurs principales
    readonly property color background: "#1A1A2E"
    readonly property color backgroundLight: "#16213E"
    
    readonly property color teamA: "#E74C3C"
    readonly property color teamALight: "#F39C12"
    
    readonly property color teamB: "#3498DB"
    readonly property color teamBLight: "#1ABC9C"
    
    readonly property color textPrimary: "#FFFFFF"
    readonly property color textSecondary: "#BDC3C7"
    
    // Dimensions
    readonly property int buttonHeight: 60
    readonly property int gaugeHeight: 50
    readonly property int spacing: 16
    readonly property int radiusSmall: 8
    readonly property int radiusLarge: 16
    
    // Animations
    readonly property int animFast: 100
    readonly property int animNormal: 200
    readonly property int animSlow: 400
    
    // Fonts
    readonly property int fontSmall: 14
    readonly property int fontNormal: 18
    readonly property int fontLarge: 24
    readonly property int fontTitle: 36
}
```

### 8.2 Game Configuration

**Fichier :** `src/qml/config/GameConfig.qml`

```qml
pragma Singleton
import QtQuick

QtObject {
    // Gameplay
    readonly property int maxGauge: 100
    readonly property int playersPerTeam: 2
    readonly property int maxPlayers: 4
    
    // Network
    readonly property int serverPort: 7777
    readonly property int discoveryPort: 7778
    readonly property int broadcastInterval: 2000  // ms
    readonly property int connectionTimeout: 3000  // ms
    
    // Bots
    readonly property var botDifficulties: ({
        easy: { minInterval: 333, maxInterval: 500 },
        normal: { minInterval: 200, maxInterval: 250 },
        hard: { minInterval: 125, maxInterval: 167 }
    })
    
    // Performance
    readonly property int maxParticles: 100
    readonly property int stateUpdateRate: 30  // par seconde
}
```

---

## 9. Testing Architecture

### 9.1 Unit Tests

**Fichier exemple :** `tests/unit/tst_gamestate.qml`

```qml
import QtQuick
import QtTest
import "../../src/js/GameState.js" as GameState

TestCase {
    name: "GameStateTests"
    
    function init() {
        GameState.resetGame()
    }
    
    function test_initialState() {
        compare(GameState.state.teamA.gauge, 0)
        compare(GameState.state.teamB.gauge, 0)
        compare(GameState.state.phase, "playing")
    }
    
    function test_incrementGauge() {
        var result = GameState.incrementGauge("A")
        verify(result === true)
        compare(GameState.state.teamA.gauge, 1)
    }
    
    function test_gaugeCannotExceedMax() {
        for (var i = 0; i < 105; i++) {
            GameState.incrementGauge("A")
        }
        compare(GameState.state.teamA.gauge, 100)
    }
    
    function test_victoryDetection() {
        for (var i = 0; i < 100; i++) {
            GameState.incrementGauge("B")
        }
        compare(GameState.checkVictory(), "B")
    }
    
    function test_resetGame() {
        GameState.incrementGauge("A")
        GameState.resetGame()
        compare(GameState.state.teamA.gauge, 0)
    }
}
```

### 9.2 Integration Tests

**Fichier exemple :** `tests/integration/tst_network.qml`

```qml
import QtQuick
import QtTest

TestCase {
    name: "NetworkIntegrationTests"
    
    property var server: null
    property var client: null
    
    function initTestCase() {
        // Créer instances serveur et client
    }
    
    function test_serverClientConnection() {
        server.start()
        wait(100)
        client.connectToServer("127.0.0.1")
        wait(500)
        verify(client.isConnected)
    }
    
    function test_clickSynchronization() {
        // Simuler 100 clics du client
        for (var i = 0; i < 100; i++) {
            client.sendClick()
        }
        wait(1000)
        // Vérifier que le serveur a reçu tous les clics
        compare(server.totalClicks, 100)
    }
    
    function cleanupTestCase() {
        server.stop()
        client.disconnect()
    }
}
```

### 9.3 Test Coverage Goals

| Module | Couverture Cible | Type de Tests |
|--------|------------------|---------------|
| GameState.js | > 90% | Unitaires |
| GameLogic.js | > 80% | Unitaires |
| BotManager.js | > 80% | Unitaires |
| NetworkManager | > 70% | Intégration |
| UI Components | Manuel | Visuel |

---

## 10. Build System

### 10.1 Makefile

**Fichier :** `Makefile`

```makefile
# ClickWars: Territory - Makefile
# Qt 6.8.3 + Felgo 4.0

# Configuration
PROJECT = clickwars-territory
QMAKE = qmake6
FELGO_SDK = $(FELGO_SDK_PATH)
BUILD_DIR = build
DIST_DIR = dist

# Détection OS
UNAME := $(shell uname)
ifeq ($(UNAME), Darwin)
    PLATFORM = macx
    APP_EXT = .app
else ifeq ($(UNAME), Linux)
    PLATFORM = linux
    APP_EXT = 
else
    PLATFORM = win32
    APP_EXT = .exe
endif

# Targets
.PHONY: all build run clean test help

all: build

help:
	@echo "ClickWars: Territory - Build System"
	@echo ""
	@echo "Targets:"
	@echo "  make build    - Compile le projet"
	@echo "  make run      - Lance l'application"
	@echo "  make test     - Exécute les tests"
	@echo "  make clean    - Nettoie les fichiers de build"
	@echo "  make dist     - Crée le package de distribution"
	@echo ""

build:
	@echo "Building $(PROJECT) for $(PLATFORM)..."
	@mkdir -p $(BUILD_DIR)
	@cd $(BUILD_DIR) && $(QMAKE) ../$(PROJECT).pro -spec $(PLATFORM)-clang CONFIG+=release
	@cd $(BUILD_DIR) && make -j4
	@echo "Build complete!"

run: build
	@echo "Running $(PROJECT)..."
ifeq ($(UNAME), Darwin)
	@open $(BUILD_DIR)/$(PROJECT)$(APP_EXT)
else
	@./$(BUILD_DIR)/$(PROJECT)$(APP_EXT)
endif

clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -rf $(DIST_DIR)
	@echo "Clean complete!"

test:
	@echo "Running tests..."
	@mkdir -p $(BUILD_DIR)/tests
	@cd $(BUILD_DIR) && $(QMAKE) ../tests/tests.pro
	@cd $(BUILD_DIR) && make -j4
	@./$(BUILD_DIR)/tests/tst_all
	@echo "Tests complete!"

dist: build
	@echo "Creating distribution package..."
	@mkdir -p $(DIST_DIR)
ifeq ($(UNAME), Darwin)
	@cp -R $(BUILD_DIR)/$(PROJECT).app $(DIST_DIR)/
else
	@cp $(BUILD_DIR)/$(PROJECT)$(APP_EXT) $(DIST_DIR)/
endif
	@echo "Distribution package created in $(DIST_DIR)/"
```

### 10.2 Project File

**Fichier :** `clickwars-territory.pro`

```qmake
# ClickWars: Territory - Qt/Felgo Project

TEMPLATE = app
TARGET = clickwars-territory

QT += quick network

CONFIG += c++17
CONFIG += felgo

# Felgo SDK
include($$(FELGO_SDK_PATH)/felgo.pri)

# Sources
SOURCES += \
    src/Main.cpp

# QML et JavaScript
QML_IMPORT_PATH += src/qml
JS_IMPORT_PATH += src/js

# Resources
RESOURCES += \
    qml.qrc \
    assets.qrc

# Fichiers QML à inclure
qml.files = \
    src/main.qml \
    src/qml/screens/*.qml \
    src/qml/components/*.qml \
    src/qml/styles/*.qml

# Fichiers JS
js.files = \
    src/js/*.js

# Installation
qml.path = $$OUT_PWD
js.path = $$OUT_PWD

INSTALLS += qml js

# Plateformes
ios {
    QMAKE_INFO_PLIST = ios/Info.plist
}

android {
    ANDROID_PACKAGE_SOURCE_DIR = android
}
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Semaine 1)

| Jour | Stories | Livrables |
|------|---------|-----------|
| J1-J2 | 1.1 Project Setup | Structure projet, Makefile, build fonctionnel |
| J2-J3 | 1.2 Main Menu | Écran d'accueil avec navigation |
| J3-J4 | 1.3 Game State | GameState.js complet avec tests |
| J4-J5 | 1.4-1.5 Gameplay | Jauges + Zone de clic fonctionnelles |
| J5-J6 | 1.6 Bots | BotManager.js + intégration |
| J6-J7 | 1.7 Victory | Écran victoire + boucle de jeu complète |

**Critère de succès Phase 1 :** Un joueur peut jouer contre des bots localement

### Phase 2: Networking (Semaines 2-3)

| Jour | Stories | Livrables |
|------|---------|-----------|
| J8-J10 | 2.1 Network Foundation | TCP Server/Client fonctionnel |
| J10-J12 | 2.2 Server Discovery | UDP Broadcast + ServerBrowser |
| J12-J14 | 2.3 Lobby | Écran lobby avec gestion équipes |
| J14-J17 | 2.4 Synchronization | État synchronisé sur tous les clients |
| J17-J19 | 2.5 Disconnection | Gestion déconnexions |
| J19-J21 | 2.6 Network Tests | Suite de tests d'intégration |

**Critère de succès Phase 2 :** 4 joueurs peuvent jouer ensemble sur LAN

### Phase 3: Visual Polish (Semaine 4)

| Jour | Stories | Livrables |
|------|---------|-----------|
| J22-J23 | 3.1 Particles | Effets de particules au clic |
| J23-J24 | 3.2 Gauge Animations | Animations jauges améliorées |
| J24-J25 | 3.3 Click Feedback | Bounce, ripple, intensité |
| J25-J26 | 3.4 Victory Effects | Célébration visuelle complète |
| J26-J27 | 3.5 Transitions | Transitions entre écrans |

**Critère de succès Phase 3 :** Expérience visuellement satisfaisante

### Phase 4: Hardening (Fin Semaine 4)

| Jour | Stories | Livrables |
|------|---------|-----------|
| J27-J28 | 4.1 Unit Tests | Couverture > 70% |
| J28-J29 | 4.2 Performance | 60 FPS vérifié, optimisations |
| J29-J30 | 4.3-4.4 Polish | Bug fixes, documentation |

**Critère de succès Phase 4 :** Application stable, documentée, prête à jouer

---

## 12. Risk Assessment

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance particules insuffisante | Moyenne | Moyen | Object pooling, réduire count si nécessaire |
| Synchronisation réseau imprécise | Haute | Haute | Serveur autoritaire strict, tests intensifs |
| Compatibilité cross-platform | Moyenne | Haute | Tests sur chaque OS dès Phase 1 |
| Latence réseau > 50ms | Basse | Moyen | UDP pour discovery seulement, TCP fiable |
| Complexité Qt.Network QML | Moyenne | Moyen | Fallback sur composants C++ si nécessaire |

---

## 13. Success Criteria

### Technical Metrics

- ✅ 60 FPS constant sur toutes les plateformes
- ✅ Latence réseau < 50ms sur LAN
- ✅ Mémoire < 200MB
- ✅ 100% des clics comptabilisés (aucune perte)
- ✅ Jauges synchronisées à 100% entre tous les clients

### Code Quality

- ✅ Couverture tests > 70% sur la logique métier
- ✅ Aucun chemin absolu dans le code
- ✅ Compatible Windows, macOS, Linux
- ✅ Documentation inline complète
- ✅ Build via Makefile fonctionnel

### User Experience

- ✅ Compréhension du jeu en < 10 secondes
- ✅ Connexion LAN en < 5 secondes
- ✅ Feedback visuel à chaque clic
- ✅ Célébration de victoire satisfaisante

---

*Document créé avec le framework BMAD-METHOD™*
