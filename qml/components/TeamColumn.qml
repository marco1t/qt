/**
 * TeamColumn.qml - Colonne d'équipe réutilisable pour le Lobby
 *
 * Affiche la liste des joueurs d'une équipe avec gestion des bots.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "../styles"

ColumnLayout {
    id: root

    property string teamName: "ÉQUIPE A"
    property string teamEmoji: "🔴"
    property color teamColor: Theme.teamA
    property color teamDarkColor: Theme.teamADark
    property var players: []
    property bool isHost: false

    signal removeBotRequested(string botId)

    spacing: 15

    Text {
        Layout.alignment: Qt.AlignHCenter
        text: root.teamEmoji + " " + root.teamName
        color: root.teamColor
        font.pixelSize: 28
        font.bold: true
    }

    Rectangle {
        Layout.fillWidth: true
        Layout.preferredHeight: 300
        color: Qt.rgba(0, 0, 0, 0.3)
        radius: 12
        border.color: root.teamColor
        border.width: 2

        ListView {
            anchors.fill: parent
            anchors.margins: 15
            spacing: 10
            model: root.players
            clip: true

            delegate: Rectangle {
                width: ListView.view.width
                height: 60
                color: modelData.isHost ? "#F39C12" : root.teamDarkColor
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

                    AnimatedButton {
                        visible: modelData.isBot && root.isHost
                        text: "✖"
                        buttonColor: Theme.danger
                        Layout.preferredWidth: 40
                        Layout.preferredHeight: 40
                        onClicked: root.removeBotRequested(modelData.id)
                    }
                }
            }
        }
    }
}
