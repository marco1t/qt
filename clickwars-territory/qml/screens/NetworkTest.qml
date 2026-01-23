/**
 * NetworkTest.qml - Test du NetworkManager
 *
 * Permet de tester la connexion client-serveur en mode debug.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "../components"
import "../styles"

Rectangle {
    id: root
    anchors.fill: parent
    color: Theme.backgroundDark

    property bool isServerMode: false

    // Référence au NetworkManager global (passé par Main.qml)
    property var networkManager: null

    // Connections pour logger les événements
    Connections {
        target: networkManager

        function onConnected() {
            logMessage("✅ Connecté au serveur");
        }

        function onDisconnected() {
            logMessage("🔌 Déconnecté du serveur");
        }

        function onMessageReceived(senderId, message) {
            logMessage("📨 Message de " + senderId + ": " + JSON.stringify(message));
        }

        function onConnectionError(error) {
            logMessage("❌ Erreur: " + error);
        }
    }

    function logMessage(msg) {
        var timestamp = Qt.formatTime(new Date(), "hh:mm:ss");
        logModel.append({
            text: "[" + timestamp + "] " + msg
        });

        // Auto-scroll
        logView.positionViewAtEnd();
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 10

        // Titre
        Text {
            text: "🌐 Network Manager Test"
            font.pixelSize: 28
            font.bold: true
            color: "white"
            Layout.alignment: Qt.AlignHCenter
        }

        // Mode sélection
        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            AnimatedButton {
                text: "Mode Serveur"
                buttonColor: isServerMode ? Theme.teamA : Theme.buttonDefault
                Layout.fillWidth: true
                onClicked: {
                    root.isServerMode = true;
                }
            }

            AnimatedButton {
                text: "Mode Client"
                buttonColor: !isServerMode ? Theme.teamB : Theme.buttonDefault
                Layout.fillWidth: true
                onClicked: {
                    root.isServerMode = false;
                }
            }
        }

        // Zone serveur
        Rectangle {
            visible: isServerMode
            Layout.fillWidth: true
            Layout.preferredHeight: 150
            color: Qt.rgba(0, 0, 0, 0.3)
            radius: 10

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 15
                spacing: 10

                Text {
                    text: "🖥️ Contrôles Serveur"
                    font.pixelSize: 18
                    font.bold: true
                    color: Theme.teamA
                }

                RowLayout {
                    spacing: 10

                    TextField {
                        id: serverPortField
                        placeholderText: "Port (défaut: 7777)"
                        text: "7777"
                        Layout.preferredWidth: 150
                    }

                    AnimatedButton {
                        text: networkManager.isServer ? "Arrêter Serveur" : "Démarrer Serveur"
                        buttonColor: networkManager.isServer ? "#e74c3c" : Theme.teamA
                        onClicked: {
                            if (networkManager.isServer) {
                                networkManager.stopServer();
                            } else {
                                var port = parseInt(serverPortField.text) || 7777;
                                networkManager.startServer(port);
                            }
                        }
                    }
                }

                Text {
                    text: "Clients connectés: " + networkManager.connectedClients.length
                    color: Theme.textSecondary
                    font.pixelSize: 14
                }

                AnimatedButton {
                    text: "📤 Envoyer message à tous"
                    enabled: networkManager.isServer && networkManager.connectedClients.length > 0
                    buttonColor: Theme.teamA
                    onClicked: {
                        networkManager.sendToAll({
                            type: "test",
                            message: "Hello from server!",
                            timestamp: Date.now()
                        });
                        logMessage("📤 Message envoyé à tous les clients");
                    }
                }
            }
        }

        // Zone client
        Rectangle {
            visible: !isServerMode
            Layout.fillWidth: true
            Layout.preferredHeight: 150
            color: Qt.rgba(0, 0, 0, 0.3)
            radius: 10

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 15
                spacing: 10

                Text {
                    text: "💻 Contrôles Client"
                    font.pixelSize: 18
                    font.bold: true
                    color: Theme.teamB
                }

                RowLayout {
                    spacing: 10

                    TextField {
                        id: serverIpField
                        placeholderText: "IP Serveur"
                        text: "127.0.0.1"
                        Layout.preferredWidth: 150
                    }

                    TextField {
                        id: clientPortField
                        placeholderText: "Port"
                        text: "7777"
                        Layout.preferredWidth: 100
                    }

                    AnimatedButton {
                        text: networkManager.isConnected ? "Déconnecter" : "Connecter"
                        buttonColor: networkManager.isConnected ? "#e74c3c" : Theme.teamB
                        onClicked: {
                            if (networkManager.isConnected) {
                                networkManager.disconnect();
                            } else {
                                var port = parseInt(clientPortField.text) || 7777;
                                networkManager.connectToServer(serverIpField.text, port);
                            }
                        }
                    }
                }

                AnimatedButton {
                    text: "📤 Envoyer message au serveur"
                    enabled: networkManager.isConnected
                    buttonColor: Theme.teamB
                    onClicked: {
                        networkManager.sendToServer({
                            type: "test",
                            message: "Hello from client!",
                            timestamp: Date.now()
                        });
                        logMessage("📤 Message envoyé au serveur");
                    }
                }

                // Nouveaux boutons de test pour la synchronisation
                Text {
                    text: "🎮 Tests de Synchronisation"
                    color: "#FFD700"
                    font.pixelSize: 14
                    font.bold: true
                    Layout.topMargin: 10
                }

                RowLayout {
                    spacing: 5
                    Layout.fillWidth: true

                    AnimatedButton {
                        text: "👤 Join Team A"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: Theme.teamA
                        Layout.fillWidth: true
                        onClicked: {
                            console.log("🔴 BOUTON JOIN A CLIQUÉ !");
                            console.log("networkManager:", networkManager);
                            console.log("networkManager.isConnected:", networkManager.isConnected);
                            networkManager.joinGame("p1", "TestPlayer", "A");
                            logMessage("📤 player_join envoyé (Team A)");
                        }
                    }

                    AnimatedButton {
                        text: "👤 Join Team B"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: Theme.teamB
                        Layout.fillWidth: true
                        onClicked: {
                            console.log("🔵 BOUTON JOIN B CLIQUÉ !");
                            networkManager.joinGame("p2", "TestPlayer2", "B");
                            logMessage("📤 player_join envoyé (Team B)");
                        }
                    }
                }

                RowLayout {
                    spacing: 5
                    Layout.fillWidth: true

                    AnimatedButton {
                        text: "👆 Click"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: "#9b59b6"
                        Layout.fillWidth: true
                        onClicked: {
                            networkManager.sendClick("p1");
                            logMessage("📤 click envoyé");
                        }
                    }

                    AnimatedButton {
                        text: "🎮 Start Game"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: "#27ae60"
                        Layout.fillWidth: true
                        onClicked: {
                            networkManager.startGame();
                            logMessage("📤 start_game envoyé");
                        }
                    }

                    AnimatedButton {
                        text: "🔄 Reset"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: "#e67e22"
                        Layout.fillWidth: true
                        onClicked: {
                            networkManager.resetGame();
                            logMessage("📤 reset_game envoyé");
                        }
                    }
                }
            }
        }

        // Console de logs
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 200  // Hauteur fixe pour ne pas bloquer les boutons
            Layout.maximumHeight: 200
            color: Qt.rgba(0, 0, 0, 0.5)
            radius: 10

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 5

                Text {
                    text: "📋 Console"
                    font.pixelSize: 16
                    font.bold: true
                    color: Theme.textPrimary
                }

                ListView {
                    id: logView
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true

                    model: ListModel {
                        id: logModel
                    }

                    delegate: Text {
                        text: model.text
                        color: Theme.textSecondary
                        font.pixelSize: 12
                        font.family: "Courier"
                        wrapMode: Text.Wrap
                        width: logView.width - 10
                    }

                    ScrollBar.vertical: ScrollBar {}
                }

                AnimatedButton {
                    text: "🗑️ Effacer logs"
                    buttonColor: Theme.buttonDefault
                    Layout.alignment: Qt.AlignRight
                    onClicked: {
                        logModel.clear();
                    }
                }
            }
        }
    }

    Component.onCompleted: {
        logMessage("NetworkTest démarré");

        // Debug: vérifier que networkManager est bien passé
        if (networkManager) {
            logMessage("✅ NetworkManager trouvé");
            logMessage("Connected: " + networkManager.isConnected);
        } else {
            logMessage("❌ NetworkManager est NULL !");
        }
    }
}
