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

    // Au lieu de gérer une liste locale, on affiche celle synchronisée du GameState
    // 'globalGameState' est accessible car injecté ou accessible via la hiérarchie parent (Main.qml)
    property var players: globalGameState ? globalGameState.lobbyPlayers : []
    
    // Ajout de la propriété manquante pour l'injection depuis Main.qml
    property var networkManager: null

    // Fond dégradé
    gradient: Gradient {
        GradientStop {
            position: 0.0
            color: Theme.backgroundDark
        }
        GradientStop {
            position: 1.0
            color: Theme.background
        }
    }

    // Assignation automatique d'équipe (alternance)
    function getAutoTeam() {
        var teamACount = players.filter(p => p.team === "A").length;
        var teamBCount = players.filter(p => p.team === "B").length;
        return teamACount <= teamBCount ? "A" : "B";
    }

    // Dans le mode réseau, addPlayer est géré par le serveur via player_join
    // Cette fonction ne sert plus en mode connecté, mais gardons là pour compatible local si besoin
    function addPlayer(playerId, playerName) {
        // En mode réseau, rien à faire ici, le serveur envoie lobby_update
    }

    // Demander au serveur d'ajouter un bot
    function addBot() {
        if (players.length >= 4) {
            console.warn("Lobby plein !");
            return;
        }

        // On demande au serveur
        if (networkManager) {
            networkManager.sendToServer({
                type: "add_bot",
                team: getAutoTeam()
            });
        }
    }

    // Demander au serveur de retirer un bot
    function removeBot(botId) {
        if (networkManager) {
            networkManager.sendToServer({
                type: "remove_bot",
                botId: botId
            });
        }
    }

    // Vérifier si on peut lancer
    function canStart() {
        var teamA = players.filter(p => p.team === "A");
        var teamB = players.filter(p => p.team === "B");
        return teamA.length >= 1 && teamB.length >= 1;
    }

    // Contenu principal
    ColumnLayout {
        anchors.centerIn: parent
        anchors.margins: 40
        spacing: 30
        width: Math.min(800, parent.width - 80)

        // Titre
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

        Item {
            Layout.preferredHeight: 10
        }

        // Configuration Objectif (Visible par tous, modifiable par Host)
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

                // Pour l'hôte: Champ éditable
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
                        border.color: Theme.accent
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

                // Pour les clients: Texte simple
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
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        Item {
            Layout.preferredHeight: 10
        }

        // Deux colonnes : Équipe A et Équipe B
        RowLayout {
            Layout.fillWidth: true
            spacing: 40

            // Équipe A
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 15

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "🔴 ÉQUIPE A"
                    color: Theme.teamA
                    font.pixelSize: 28
                    font.bold: true
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 300
                    color: Qt.rgba(0, 0, 0, 0.3)
                    radius: 12
                    border.color: Theme.teamA
                    border.width: 2

                    ListView {
                        anchors.fill: parent
                        anchors.margins: 15
                        spacing: 10
                        model: players.filter(p => p.team === "A")
                        clip: true

                        delegate: Rectangle {
                            width: ListView.view.width
                            height: 60
                            color: modelData.isHost ? "#F39C12" : Theme.teamADark
                            radius: 8
                            border.color: modelData.isHost ? "#F1C40F" : "transparent"
                            border.width: 2

                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 10
                                spacing: 10

                                Text {
                                    text: modelData.isBot ? "🤖" : "👤"
                                    font.pixelSize: 24
                                }

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2

                                    Text {
                                        text: modelData.name
                                        color: "white"
                                        font.pixelSize: 18
                                        font.bold: true
                                    }

                                    Text {
                                        visible: modelData.isHost
                                        text: "(Hôte)"
                                        color: "#F1C40F"
                                        font.pixelSize: 12
                                    }
                                }

                                // Bouton retirer (bots seulement, hôte seulement)
                                AnimatedButton {
                                    visible: modelData.isBot && root.isHost
                                    text: "✖"
                                    buttonColor: Theme.danger
                                    Layout.preferredWidth: 40
                                    Layout.preferredHeight: 40

                                    onClicked: {
                                        removeBot(modelData.id);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Équipe B
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 15

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "🔵 ÉQUIPE B"
                    color: Theme.teamB
                    font.pixelSize: 28
                    font.bold: true
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 300
                    color: Qt.rgba(0, 0, 0, 0.3)
                    radius: 12
                    border.color: Theme.teamB
                    border.width: 2

                    ListView {
                        anchors.fill: parent
                        anchors.margins: 15
                        spacing: 10
                        model: players.filter(p => p.team === "B")
                        clip: true

                        delegate: Rectangle {
                            width: ListView.view.width
                            height: 60
                            color: modelData.isHost ? "#F39C12" : Theme.teamBDark
                            radius: 8
                            border.color: modelData.isHost ? "#F1C40F" : "transparent"
                            border.width: 2

                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 10
                                spacing: 10

                                Text {
                                    text: modelData.isBot ? "🤖" : "👤"
                                    font.pixelSize: 24
                                }

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2

                                    Text {
                                        text: modelData.name
                                        color: "white"
                                        font.pixelSize: 18
                                        font.bold: true
                                    }

                                    Text {
                                        visible: modelData.isHost
                                        text: "(Hôte)"
                                        color: "#F1C40F"
                                        font.pixelSize: 12
                                    }
                                }

                                // Bouton retirer (bots seulement, hôte seulement)
                                AnimatedButton {
                                    visible: modelData.isBot && root.isHost
                                    text: "✖"
                                    buttonColor: Theme.danger
                                    Layout.preferredWidth: 40
                                    Layout.preferredHeight: 40

                                    onClicked: {
                                        removeBot(modelData.id);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Item {
            Layout.preferredHeight: 20
        }

        // Actions (Hôte seulement)
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 20
            visible: isHost

            AnimatedButton {
                text: "🤖 Ajouter Bot"
                buttonColor: Theme.buttonDefault
                // enabled: players.length < 4  -- LIMIT REMOVED

                onClicked: {
                    addBot();
                }
            }

            AnimatedButton {
                text: "🚀 LANCER LA PARTIE"
                buttonColor: Theme.success
                enabled: canStart()

                onClicked: {
                    if (networkManager) {
                        networkManager.startGame(); // Envoie start_game au serveur
                        // La navigation se fera quand on recevra l'update "playing" ou le message "game_start"
                    }
                }
            }
        }

        // Info pour les clients
        Text {
            Layout.alignment: Qt.AlignHCenter
            visible: !isHost
            text: "Attendez que l'hôte lance la partie..."
            color: Theme.textSecondary
            font.pixelSize: 18
            font.italic: true
        }

        // Spacer
        Item {
            Layout.fillHeight: true
        }

        // Bouton Quitter
        AnimatedButton {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 200
            text: "← Quitter"
            buttonColor: Theme.danger

            onClicked: root.backToMenu()
        }
    }
}
