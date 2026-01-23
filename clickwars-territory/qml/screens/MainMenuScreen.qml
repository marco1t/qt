/**
 * MainMenuScreen.qml - Écran d'accueil
 *
 * Affiche le titre du jeu et les boutons de navigation.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "../styles"
import "../components"

Rectangle {
    id: root

    signal navigateTo(string screenName)

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

    // Contenu centré
    ColumnLayout {
        anchors.centerIn: parent
        spacing: 24

        // Titre
        Column {
            Layout.alignment: Qt.AlignHCenter
            spacing: 8

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "⚔️"
                font.pixelSize: 64
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "CLICKWARS"
                color: Theme.textPrimary
                font.pixelSize: 64
                font.bold: true
                font.letterSpacing: 4

                SequentialAnimation on scale {
                    loops: Animation.Infinite
                    NumberAnimation {
                        to: 1.02
                        duration: 1500
                        easing.type: Easing.InOutSine
                    }
                    NumberAnimation {
                        to: 1.0
                        duration: 1500
                        easing.type: Easing.InOutSine
                    }
                }
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "TERRITORY"
                color: Theme.teamA
                font.pixelSize: 32
                font.bold: true
                font.letterSpacing: 8
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Cliquez ensemble, conquérez ensemble !"
                color: Theme.textSecondary
                font.pixelSize: 18
                font.italic: true
                topPadding: 16
            }
        }

        // Espace
        Item {
            Layout.preferredHeight: 40
        }

        // Boutons
        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 16

            AnimatedButton {
                Layout.preferredWidth: 280
                Layout.preferredHeight: 56
                text: "Créer Partie"
                buttonColor: Theme.teamA
                onClicked: root.navigateTo("lobby")
            }

            AnimatedButton {
                Layout.preferredWidth: 280
                Layout.preferredHeight: 56
                text: "Rejoindre Partie"
                buttonColor: Theme.teamB
                onClicked: root.navigateTo("browser")
            }

            Item {
                Layout.preferredHeight: 8
            }

            AnimatedButton {
                Layout.preferredWidth: 280
                Layout.preferredHeight: 48
                text: "🌐 Test Réseau (Debug)"
                buttonColor: "#9b59b6"
                onClicked: root.navigateTo("networkTest")
            }

            Item {
                Layout.preferredHeight: 8
            }

            AnimatedButton {
                Layout.preferredWidth: 280
                Layout.preferredHeight: 56
                text: "Quitter"
                buttonColor: Theme.buttonDefault
                onClicked: root.navigateTo("quit")
            }
        }
    }

    // Barres latérales décoratives
    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 6
        gradient: Gradient {
            GradientStop {
                position: 0.0
                color: Theme.teamA
            }
            GradientStop {
                position: 1.0
                color: Theme.teamADark
            }
        }
    }

    Rectangle {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 6
        gradient: Gradient {
            GradientStop {
                position: 0.0
                color: Theme.teamB
            }
            GradientStop {
                position: 1.0
                color: Theme.teamBDark
            }
        }
    }

    // Version en bas
    Text {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 16
        text: "Qt 6.8.3"
        color: Theme.textMuted
        font.pixelSize: 12
    }
}
