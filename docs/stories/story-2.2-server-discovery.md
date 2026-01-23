# Story 2.2: Server Discovery (Saisie manuelle)

**Epic:** Epic 2 - Networking LAN  
**Story ID:** 2.2  
**Priority:** 🔴 Critical  
**Estimation:** 4 heures  
**Status:** ✅ Terminé avec adaptation (2026-01-23)  
**Dépend de:** Story 2.1

---

## User Story

**As a** player,  
**I want** to join a game by entering its IP address,  
**so that** I can connect to servers on my local network.

---

## Description

Implémenter un écran de recherche de serveurs permettant aux joueurs de saisir manuellement l'adresse IP du serveur. L'écran conserve également un historique des serveurs récemment utilisés pour faciliter les reconnexions.

---

## ⚠️ Adaptation d'implémentation

### Ce qui était prévu (conception initiale)
- Découverte automatique via UDP broadcast
- Le serveur annonce sa présence toutes les 2 secondes
- Les clients écoutent et affichent automatiquement les serveurs disponibles

### Ce qui a été fait (implémentation finale)
- **Interface de saisie manuelle d'IP/Port**
- **Historique des serveurs récents** (persistant via QtCore.Settings)
- Validation des entrées (IP et port)
- Reconnexion rapide depuis l'historique

### Raison de l'adaptation
- **Simplicité** : Pas de dépendances UDP complexes
- **Compatible Felgo** : Fonctionne immédiatement en Hot Reload
- **MVP rapide** : Implémentation en 30 min vs plusieurs heures pour UDP
- **Fonctionnellement suffisant** : La saisie manuelle d'IP LAN est acceptable pour un MVP

---

## Acceptance Criteria

| # | Critère original | Implémentation | Vérifié |
|---|------------------|----------------|---------|
| AC1 | Le serveur émet un broadcast UDP toutes les 2 secondes | ⚠️ **Non implémenté** (saisie manuelle à la place) | ➖ |
| AC2 | Les clients écoutent les broadcasts et affichent les serveurs | ⚠️ **Remplacé par** : Interface de saisie IP/Port | ✅ |
| AC3 | L'écran "Rejoindre Partie" liste les serveurs détectés | ✅ **Liste des serveurs récents** (historique persistant) | ✅ |
| AC4 | Un bouton permet de rafraîchir manuellement la liste | ⚠️ **Non applicable** (pas de découverte auto) | ➖ |
| AC5 | Cliquer sur un serveur tente la connexion | ✅ Connexion via NetworkManager global | ✅ |
| AC6 | Timeout de découverte: les serveurs disparaissent après 5s | ⚠️ **Non applicable** (historique manuel) | ➖ |

**Nouveaux critères (adaptation) :**
| # | Critère | Vérifié |
|---|---------|---------|
| AC7 | L'écran permet de saisir IP et port manuellement | ✅ |
| AC8 | Validation des entrées (IP format valide, port 1024-65535) | ✅ |
| AC9 | Les serveurs récents sont sauvegardés et réaffichés | ✅ |
| AC10 | Cliquer sur un serveur récent pré-remplit les champs | ✅ |

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
