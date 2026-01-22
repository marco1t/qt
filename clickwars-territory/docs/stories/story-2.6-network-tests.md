# Story 2.6: Network Testing Suite

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.6  
**Priority:** 🟡 High  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 2.4, Story 2.5

---

## User Story

**As a** developer,  
**I want** comprehensive network integration tests,  
**so that** I can verify multiplayer functionality works correctly.

---

## Description

Créer une suite de tests d'intégration complète pour valider tous les aspects du réseau : connexion, synchronisation, déconnexion, et performance.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Tests de connexion/déconnexion multiples clients | ☐ |
| AC2 | Tests de synchronisation des jauges (4 clients cliquant simultanément) | ☐ |
| AC3 | Tests de découverte serveur (broadcast) | ☐ |
| AC4 | Tests de charge: 1000 clics répartis sur 4 clients | ☐ |
| AC5 | Tests de latence: vérifier < 50ms | ☐ |
| AC6 | Tous les tests passent de manière répétable | ☐ |
| AC7 | Documentation des procédures de test manuel | ☐ |

---

## Technical Notes

### Structure des Tests

```
tests/
├── integration/
│   ├── tst_network_connection.qml
│   ├── tst_network_sync.qml
│   ├── tst_network_discovery.qml
│   ├── tst_network_stress.qml
│   └── tst_network_latency.qml
└── manual/
    └── TEST_PROCEDURES.md
```

### Test: Connexion/Déconnexion

```javascript
// tst_network_connection.qml
TestCase {
    name: "NetworkConnectionTests"
    
    function test_singleClientConnect() {
        var server = createServer()
        verify(server.start())
        
        var client = createClient()
        client.connectTo("127.0.0.1")
        
        wait(500)
        verify(client.isConnected)
        compare(server.clientCount, 1)
        
        client.disconnect()
        wait(100)
        compare(server.clientCount, 0)
    }
    
    function test_multipleClientsConnect() {
        var server = createServer()
        server.start()
        
        var clients = []
        for (var i = 0; i < 3; i++) {
            var c = createClient()
            c.connectTo("127.0.0.1")
            clients.push(c)
        }
        
        wait(1000)
        compare(server.clientCount, 3)
        
        // Déconnecter tous
        clients.forEach(c => c.disconnect())
        wait(500)
        compare(server.clientCount, 0)
    }
    
    function test_maxPlayersEnforced() {
        var server = createServer()
        server.start()
        
        // Connecter 4 clients (max)
        for (var i = 0; i < 4; i++) {
            createClient().connectTo("127.0.0.1")
        }
        wait(500)
        
        // Le 5ème doit être refusé
        var extraClient = createClient()
        extraClient.connectTo("127.0.0.1")
        wait(500)
        
        verify(!extraClient.isConnected)
        compare(server.clientCount, 4)
    }
}
```

### Test: Synchronisation

```javascript
// tst_network_sync.qml
TestCase {
    name: "NetworkSyncTests"
    
    function test_gaugesSync() {
        setupFullGame() // 1 serveur + 3 clients
        
        // Tous les clients envoient des clics
        clients[0].sendClicks(10) // Team A
        clients[1].sendClicks(10) // Team B
        clients[2].sendClicks(10) // Team B
        
        wait(500)
        
        // Vérifier sync
        var serverState = server.getState()
        clients.forEach(function(client) {
            var clientState = client.getState()
            compare(clientState.teamAGauge, serverState.teamAGauge)
            compare(clientState.teamBGauge, serverState.teamBGauge)
        })
    }
    
    function test_victorySync() {
        setupFullGame()
        
        // Un joueur remplit sa jauge
        for (var i = 0; i < 100; i++) {
            clients[0].sendClick()
        }
        
        wait(500)
        
        // Tous doivent voir la victoire
        clients.forEach(function(client) {
            compare(client.victoryWinner, "A")
        })
    }
}
```

### Test: Découverte

```javascript
// tst_network_discovery.qml
TestCase {
    name: "NetworkDiscoveryTests"
    
    function test_broadcastReceived() {
        var server = createServer()
        server.setName("Test Game")
        server.start()
        
        var client = createClient()
        var discovered = []
        
        client.onServerDiscovered.connect(function(ip, info) {
            discovered.push({ ip: ip, info: info })
        })
        
        client.startDiscovery()
        wait(3000) // Attendre quelques broadcasts
        
        verify(discovered.length >= 1)
        compare(discovered[0].info.name, "Test Game")
    }
    
    function test_multipleServersDiscovered() {
        var server1 = createServer()
        server1.setName("Game 1")
        server1.start()
        
        var server2 = createServer()
        server2.setName("Game 2")
        server2.setPort(7788)
        server2.start()
        
        var client = createClient()
        var discovered = []
        
        client.onServerDiscovered.connect(function(ip, info) {
            discovered.push(info.name)
        })
        
        client.startDiscovery()
        wait(3000)
        
        verify(discovered.includes("Game 1"))
        verify(discovered.includes("Game 2"))
    }
}
```

### Test: Stress

```javascript
// tst_network_stress.qml
TestCase {
    name: "NetworkStressTests"
    
    function test_1000clicks() {
        setupFullGame()
        
        var totalClicks = 1000
        var clicksPerClient = totalClicks / 4
        
        // Envoyer 250 clics par client
        clients.forEach(function(client) {
            for (var i = 0; i < clicksPerClient; i++) {
                client.sendClick()
            }
        })
        
        wait(2000) // Laisser le temps de sync
        
        // Vérifier le total
        var serverTotal = server.teamAGauge + server.teamBGauge
        
        // Tolérance: certains clics après 100 sont ignorés
        verify(serverTotal <= 100) // Max 100 par jauge
        console.log("Total clics comptabilisés:", serverTotal)
    }
    
    function test_rapidClickBurst() {
        setupFullGame()
        
        // Burst de 50 clics en moins de 1 seconde
        var start = Date.now()
        for (var i = 0; i < 50; i++) {
            clients[0].sendClick()
        }
        var duration = Date.now() - start
        
        console.log("50 clics envoyés en", duration, "ms")
        
        wait(500)
        
        // Vérifier que le serveur les a reçus
        verify(server.teamAGauge >= 45) // Tolérance 90%
    }
}
```

### Test: Latence

```javascript
// tst_network_latency.qml
TestCase {
    name: "NetworkLatencyTests"
    
    function test_clickToUpdateLatency() {
        setupFullGame()
        
        var latencies = []
        
        clients[0].onStateUpdate.connect(function(update) {
            var latency = Date.now() - update.timestamp
            latencies.push(latency)
        })
        
        // Envoyer 20 clics et mesurer la latence
        for (var i = 0; i < 20; i++) {
            clients[0].sendClick()
            wait(100)
        }
        
        wait(500)
        
        // Calculer la moyenne
        var avg = latencies.reduce((a,b) => a+b, 0) / latencies.length
        console.log("Latence moyenne:", avg, "ms")
        
        verify(avg < 50) // Objectif < 50ms sur LAN
    }
}
```

### Documentation Test Manuel

```markdown
# TEST_PROCEDURES.md

## Test Manuel: 4 Joueurs sur LAN

### Prérequis
- 4 ordinateurs sur le même réseau local
- Application installée sur chaque machine

### Procédure

1. **Machine 1 - Créer une partie**
   - Lancer l'application
   - Cliquer "Créer Partie"
   - Noter le nom de la partie

2. **Machines 2, 3, 4 - Rejoindre**
   - Lancer l'application
   - Cliquer "Rejoindre Partie"
   - Sélectionner la partie de Machine 1
   - Vérifier: apparaît dans le lobby

3. **Configurer les équipes**
   - Machine 1 assigne les équipes (2 par équipe)
   - Vérifier: tous voient la même configuration

4. **Lancer la partie**
   - Machine 1 clique "Lancer"
   - Vérifier: toutes les machines passent en jeu

5. **Test de synchronisation**
   - Chaque joueur clique plusieurs fois
   - Vérifier: les jauges progressent identiquement

6. **Test de victoire**
   - Jouer jusqu'à ce qu'une équipe gagne
   - Vérifier: toutes machines affichent le gagnant

7. **Test de déconnexion**
   - Fermer abruptement Machine 3
   - Vérifier: bot remplace le joueur
   - Vérifier: notification affichée

### Critères de Réussite
- [ ] Découverte automatique < 5s
- [ ] Jauges parfaitement synchronisées
- [ ] Pas de crash ou freeze
- [ ] Latence imperceptible
```

---

## Definition of Done

- [ ] Tous les tests automatisés passent
- [ ] Tests de stress validés (1000 clics)
- [ ] Latence < 50ms vérifiée
- [ ] Documentation de test manuel créée
- [ ] Tests reproductibles sur CI

---

## Références

- [Architecture Section 9](/docs/architecture/game-architecture.md#9-testing-architecture)
- [PRD NFR10, NFR11](/docs/prd.md)
