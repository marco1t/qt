# Story 2.1: Network Module Foundation

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.1  
**Priority:** 🔴 Critical  
**Estimation:** 6 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.1

---

## User Story

**As a** developer,  
**I want** a network module that handles TCP/UDP communication,  
**so that** clients and server can exchange messages.

---

## Description

Créer le module réseau de base qui gère les communications TCP pour le gameplay et UDP pour la découverte de serveurs. Ce module est la fondation de tout le multijoueur.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Un module `NetworkManager` QML/JS est créé | ☐ |
| AC2 | Le module peut démarrer un serveur TCP sur un port configurable (défaut: 7777) | ☐ |
| AC3 | Le module peut se connecter à un serveur en tant que client | ☐ |
| AC4 | Les messages peuvent être envoyés/reçus au format JSON | ☐ |
| AC5 | Les événements connexion/déconnexion/erreur sont signalés | ☐ |
| AC6 | Tests d'intégration vérifient la communication de base entre 2 instances | ☐ |

---

## Technical Notes

### Fichiers à créer

- `src/js/NetworkManager.js` - Logique réseau
- `src/qml/components/NetworkComponent.qml` - Wrapper QML pour les sockets

### Configuration Réseau

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| TCP Port | 7777 | Port du serveur de jeu |
| UDP Port | 7778 | Port pour la découverte |
| Timeout | 3000ms | Délai de déconnexion |

### API NetworkManager

```javascript
// Serveur
function startServer(port)
function stopServer()
function sendToAll(message)
function sendToClient(clientId, message)
function getConnectedClients()

// Client
function connectToServer(ip, port)
function disconnect()
function sendToServer(message)

// États
function isServer()
function isConnected()
function getLocalIp()

// Événements (via signaux QML)
// onClientConnected(clientId)
// onClientDisconnected(clientId)
// onMessageReceived(clientId, message)
// onError(errorMessage)
```

### Composant QML avec Qt.Network

```qml
// NetworkComponent.qml
import QtQuick
import Felgo

Item {
    id: networkManager
    
    property bool isServerMode: false
    property bool isConnected: false
    property int port: 7777
    
    signal clientConnected(string clientId)
    signal clientDisconnected(string clientId)
    signal messageReceived(string clientId, var message)
    signal connectionError(string error)
    
    // Serveur TCP (Felgo/Qt fournit ces composants)
    TcpServer {
        id: tcpServer
        
        onNewConnection: function(socket) {
            var clientId = socket.peerAddress + ":" + socket.peerPort
            clientConnected(clientId)
            
            socket.onReadyRead.connect(function() {
                var data = socket.readAll()
                try {
                    var msg = JSON.parse(data)
                    messageReceived(clientId, msg)
                } catch (e) {
                    console.error("Invalid JSON:", data)
                }
            })
            
            socket.onDisconnected.connect(function() {
                clientDisconnected(clientId)
            })
        }
    }
    
    // Client TCP
    TcpSocket {
        id: tcpClient
        
        onConnected: {
            isConnected = true
        }
        
        onDisconnected: {
            isConnected = false
        }
        
        onReadyRead: {
            var data = readAll()
            try {
                var msg = JSON.parse(data)
                messageReceived("server", msg)
            } catch (e) {
                console.error("Invalid JSON:", data)
            }
        }
        
        onError: function(err) {
            connectionError(err)
        }
    }
    
    // Fonctions publiques
    function startServer() {
        isServerMode = true
        tcpServer.listen(port)
        return tcpServer.isListening
    }
    
    function connectToServer(ip) {
        isServerMode = false
        tcpClient.connectToHost(ip, port)
    }
    
    function sendMessage(msg) {
        var json = JSON.stringify(msg) + "\n"
        if (isServerMode) {
            tcpServer.sendToAll(json)
        } else {
            tcpClient.write(json)
        }
    }
}
```

### Format des messages

```javascript
// Tous les messages suivent ce format
{
    "type": "message_type",
    "timestamp": 1706043600000,
    "payload": { /* données spécifiques */ }
}
```

---

## Tests d'intégration

```javascript
// tests/integration/tst_network.qml
function test_serverClientConnection() {
    // Démarrer le serveur
    var server = createNetworkComponent()
    verify(server.startServer())
    
    // Connecter un client
    var client = createNetworkComponent()
    client.connectToServer("127.0.0.1")
    
    wait(500)
    verify(client.isConnected)
}

function test_messageExchange() {
    // Setup serveur et client
    var server = createNetworkComponent()
    server.startServer()
    
    var client = createNetworkComponent()
    var receivedMessage = null
    
    server.messageReceived.connect(function(clientId, msg) {
        receivedMessage = msg
    })
    
    client.connectToServer("127.0.0.1")
    wait(500)
    
    // Envoyer un message
    client.sendMessage({ type: "test", data: "hello" })
    wait(100)
    
    verify(receivedMessage !== null)
    compare(receivedMessage.type, "test")
    compare(receivedMessage.data, "hello")
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Le serveur accepte plusieurs connexions
- [ ] Les messages sont correctement sérialisés/désérialisés
- [ ] Les erreurs sont gérées proprement
- [ ] Tests d'intégration passent

---

## Références

- [Architecture Section 4.2](/docs/architecture/game-architecture.md#42-network-management-system)
- [Architecture Section 6](/docs/architecture/game-architecture.md#6-network-protocol-specification)
- [PRD FR8-FR13](/docs/prd.md)
