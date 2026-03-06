/**
 * NetworkTest.qml - Test du NetworkManager (Debug)
 *
 * Permet de tester la connexion client-serveur.
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

    ToastNotification {
        id: localToast
        z: 1000
    }

    property var networkManager: null

    Connections {
        target: networkManager

        function onConnected() { logMessage("✅ Connecté au serveur") }
        function onDisconnected() { logMessage("🔌 Déconnecté du serveur") }

        function onConnectionError(error) {
            logMessage("❌ Erreur: " + error);
            localToast.showError(error);
        }

        function onMessageReceived(senderId, message) {
            logMessage("📨 Message de " + senderId + ": " + JSON.stringify(message));
            if (message.type === "player_left") {
                localToast.showPlayerLeft(message.playerName || message.playerId);
            }
        }
    }

    function logMessage(msg) {
        var timestamp = Qt.formatTime(new Date(), "hh:mm:ss");
        logModel.append({ text: "[" + timestamp + "] " + msg });
        logView.positionViewAtEnd();
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 10

        Text {
            text: "🌐 Network Manager Test"
            font.pixelSize: 28
            font.bold: true
            color: "white"
            Layout.alignment: Qt.AlignHCenter
        }

        // Contrôles Client
        Rectangle {
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
                    buttonEnabled: networkManager.isConnected
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
                        text: "🔔 Reset"
                        buttonEnabled: networkManager.isConnected
                        buttonColor: "#e67e22"
                        Layout.fillWidth: true
                        onClicked: {
                            networkManager.resetGame();
                            logMessage("📤 reset_game envoyé");
                        }
                    }

                    AnimatedButton {
                        text: "🔔 Test Toast"
                        buttonColor: "#9b59b6"
                        Layout.fillWidth: true
                        onClicked: {
                            localToast.showPlayerLeft("TestPlayer");
                            logMessage("🔔 Toast test affiché");
                        }
                    }
                }
            }
        }

        // Console de logs
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
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

                    model: ListModel { id: logModel }

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

                RowLayout {
                    spacing: 10
                    Layout.alignment: Qt.AlignRight

                    AnimatedButton {
                        text: "🗑️ Effacer logs"
                        buttonColor: Theme.buttonDefault
                        onClicked: logModel.clear()
                    }
                }
            }
        }
    }

    Component.onCompleted: {
        logMessage("NetworkTest démarré");
        if (networkManager) {
            logMessage("✅ NetworkManager trouvé");
            logMessage("Connected: " + networkManager.isConnected);
        } else {
            logMessage("❌ NetworkManager est NULL !");
        }
    }
}
