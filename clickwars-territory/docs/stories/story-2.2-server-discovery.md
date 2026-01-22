# Story 2.2: Server Discovery (UDP Broadcast)

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.2  
**Priority:** 🔴 Critical  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 2.1

---

## User Story

**As a** player,  
**I want** to see available games on my local network automatically,  
**so that** I can join without typing IP addresses.

---

## Description

Implémenter la découverte automatique des serveurs sur le réseau local via UDP broadcast. Les serveurs annoncent leur présence, les clients écoutent et affichent la liste.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Le serveur émet un broadcast UDP toutes les 2 secondes avec ses infos | ☐ |
| AC2 | Les clients écoutent les broadcasts et affichent les serveurs disponibles | ☐ |
| AC3 | L'écran "Rejoindre Partie" liste les serveurs détectés avec leur nombre de joueurs | ☐ |
| AC4 | Un bouton permet de rafraîchir manuellement la liste | ☐ |
| AC5 | Cliquer sur un serveur tente la connexion | ☐ |
| AC6 | Timeout de découverte: les serveurs disparaissent après 5s sans signal | ☐ |

---

## Technical Notes

### Fichiers à créer/modifier

- `src/js/NetworkManager.js` - Ajouter UDP
- `src/qml/screens/ServerBrowserScreen.qml` - Liste des serveurs

### Message Broadcast (UDP)

```javascript
{
    "type": "server_announce",
    "name": "Partie de Player1",
    "players": 2,
    "maxPlayers": 4,
    "port": 7777,
    "version": "1.0"
}
```

### Composant UDP

```qml
// Dans NetworkComponent.qml
UdpSocket {
    id: udpSocket
    port: 7778  // Discovery port
    
    Component.onCompleted: {
        // Activer le broadcast
        joinMulticastGroup("255.255.255.255")
    }
    
    onDatagramReceived: function(data, host, port) {
        try {
            var msg = JSON.parse(data)
            if (msg.type === "server_announce") {
                serverDiscovered(host, msg)
            }
        } catch (e) {
            console.error("Invalid broadcast:", data)
        }
    }
}

// Timer pour broadcast serveur
Timer {
    id: broadcastTimer
    interval: 2000
    repeat: true
    running: isServerMode
    
    onTriggered: {
        var announce = JSON.stringify({
            type: "server_announce",
            name: gameName,
            players: connectedClients.length,
            maxPlayers: 4,
            port: serverPort,
            version: "1.0"
        })
        udpSocket.send(announce, "255.255.255.255", 7778)
    }
}
```

### ServerBrowserScreen

```qml
// ServerBrowserScreen.qml
Scene {
    id: browserScreen
    
    property var servers: ({})  // ip -> serverInfo
    
    // Nettoyage des serveurs inactifs
    Timer {
        interval: 1000
        repeat: true
        running: true
        onTriggered: cleanupStaleServers()
    }
    
    function cleanupStaleServers() {
        var now = Date.now()
        for (var ip in servers) {
            if (now - servers[ip].lastSeen > 5000) {
                delete servers[ip]
            }
        }
        serversChanged()
    }
    
    // Liste des serveurs
    ListView {
        model: Object.values(servers)
        
        delegate: Rectangle {
            width: parent.width
            height: 60
            color: mouseArea.containsMouse ? "#2C3E50" : "#1A1A2E"
            
            Row {
                anchors.centerIn: parent
                spacing: 20
                
                Text {
                    text: modelData.name
                    color: "white"
                    font.pixelSize: 20
                }
                
                Text {
                    text: modelData.players + "/" + modelData.maxPlayers
                    color: "#BDC3C7"
                    font.pixelSize: 16
                }
            }
            
            MouseArea {
                id: mouseArea
                anchors.fill: parent
                hoverEnabled: true
                onClicked: joinServer(modelData.ip)
            }
        }
    }
    
    // Bouton rafraîchir
    AnimatedButton {
        text: "Rafraîchir"
        onClicked: {
            servers = {}
            // Émettre un ping pour forcer les réponses
        }
    }
    
    // Connexion aux signaux réseau
    Connections {
        target: Network
        
        function onServerDiscovered(ip, info) {
            servers[ip] = {
                ip: ip,
                name: info.name,
                players: info.players,
                maxPlayers: info.maxPlayers,
                lastSeen: Date.now()
            }
            serversChanged()
        }
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Les serveurs apparaissent automatiquement dans la liste
- [ ] Les serveurs disparaissent après 5s d'inactivité
- [ ] Cliquer sur un serveur initie la connexion
- [ ] Fonctionne sur le même réseau WiFi/Ethernet

---

## Références

- [Architecture Section 6.1](/docs/architecture/game-architecture.md#61-message-types)
- [PRD FR9, FR10](/docs/prd.md)
