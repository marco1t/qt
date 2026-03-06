/**
 * LobbyScreen.qml - Écran de lobby multijoueur
 *
 * Permet à l'hôte de gérer les joueurs et lancer la partie.
 * Les clients voient l'état du lobby en temps réel.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "../styles"
import "../components"

Rectangle {
    id: root

    signal backToMenu
    signal startGame(var players)

    property bool isHost: false
    property string localPlayerId: ""
    property var players: globalGameState ? globalGameState.lobbyPlayers : []
    property var networkManager: null

    gradient: Gradient {
        GradientStop { position: 0.0; color: Theme.backgroundDark }
        GradientStop { position: 1.0; color: Theme.background }
    }

    function getAutoTeam() {
        var teamACount = players.filter(p => p.team === "A").length;
        var teamBCount = players.filter(p => p.team === "B").length;
        return teamACount <= teamBCount ? "A" : "B";
    }

    function addBot() {
        if (networkManager) {
            networkManager.sendToServer({
                type: "add_bot",
                team: getAutoTeam()
            });
        }
    }

    function removeBot(botId) {
        if (networkManager) {
            networkManager.sendToServer({
                type: "remove_bot",
                botId: botId
            });
        }
    }

    function canStart() {
        var teamA = players.filter(p => p.team === "A");
        var teamB = players.filter(p => p.team === "B");
        return teamA.length >= 1 && teamB.length >= 1;
    }

    ColumnLayout {
        anchors.centerIn: parent
        anchors.margins: 40
        spacing: 30
        width: Math.min(800, parent.width - 80)

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "🎮 Lobby de jeu"
            color: Theme.textPrimary
            font.pixelSize: 48
            font.bold: true
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: isHost ? "👑 Vous êtes l'hôte" : "⏳ En attente de l'hôte..."
            color: isHost ? "#F1C40F" : Theme.textSecondary
            font.pixelSize: 20
        }

        Item { Layout.preferredHeight: 10 }

        // Configuration Objectif
        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 5

            Text {
                text: "🎯 Objectif de clics"
                color: Theme.textSecondary
                font.pixelSize: 16
                Layout.alignment: Qt.AlignHCenter
            }

            RowLayout {
                spacing: 10
                Layout.alignment: Qt.AlignHCenter

                TextField {
                    id: maxGaugeInput
                    visible: isHost
                    text: globalGameState ? globalGameState.maxGauge.toString() : "100"
                    color: "white"
                    font.pixelSize: 20
                    font.bold: true
                    horizontalAlignment: TextInput.AlignHCenter
                    background: Rectangle {
                        color: Qt.rgba(0, 0, 0, 0.5)
                        radius: 8
                        border.color: Theme.teamA
                        border.width: 1
                    }
                    Layout.preferredWidth: 120
                    validator: IntValidator { bottom: 10; top: 1000000 }
                    onEditingFinished: {
                        var val = parseInt(text);
                        if (!isNaN(val) && networkManager) {
                            networkManager.sendToServer({
                                type: "update_config",
                                maxGauge: val
                            });
                        }
                    }
                }

                Text {
                    visible: !isHost
                    text: globalGameState ? globalGameState.maxGauge.toString() : "100"
                    color: "white"
                    font.pixelSize: 24
                    font.bold: true
                }

                Text {
                    text: "clics"
                    color: Theme.textSecondary
                    font.pixelSize: 16
                }
            }
        }

        Item { Layout.preferredHeight: 10 }

        // Deux colonnes d'équipe (composant réutilisable)
        RowLayout {
            Layout.fillWidth: true
            spacing: 40

            TeamColumn {
                Layout.fillWidth: true
                teamName: "ÉQUIPE A"
                teamEmoji: "🔴"
                teamColor: Theme.teamA
                teamDarkColor: Theme.teamADark
                players: root.players.filter(p => p.team === "A")
                isHost: root.isHost
                onRemoveBotRequested: function(botId) { removeBot(botId) }
            }

            TeamColumn {
                Layout.fillWidth: true
                teamName: "ÉQUIPE B"
                teamEmoji: "🔵"
                teamColor: Theme.teamB
                teamDarkColor: Theme.teamBDark
                players: root.players.filter(p => p.team === "B")
                isHost: root.isHost
                onRemoveBotRequested: function(botId) { removeBot(botId) }
            }
        }

        Item { Layout.preferredHeight: 20 }

        // Actions (Hôte seulement)
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 20
            visible: isHost

            AnimatedButton {
                text: "🤖 Ajouter Bot"
                buttonColor: Theme.buttonDefault
                onClicked: addBot()
            }

            AnimatedButton {
                text: "🚀 LANCER LA PARTIE"
                buttonColor: Theme.success
                buttonEnabled: canStart()
                onClicked: {
                    if (networkManager) {
                        networkManager.startGame();
                    }
                }
            }
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            visible: !isHost
            text: "Attendez que l'hôte lance la partie..."
            color: Theme.textSecondary
            font.pixelSize: 18
            font.italic: true
        }

        Item { Layout.fillHeight: true }

        AnimatedButton {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 200
            text: "← Quitter"
            buttonColor: Theme.danger
            onClicked: root.backToMenu()
        }
    }
}
