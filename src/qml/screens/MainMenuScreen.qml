/**
 * MainMenuScreen.qml - Écran d'accueil du jeu
 *
 * Affiche le titre et les boutons de navigation :
 * - Créer Partie
 * - Rejoindre Partie
 * - Quitter
 */

import QtQuick
import QtQuick.Controls
import "../styles"
import "../components"

Rectangle {
    id: mainMenu

    // Signal de navigation
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

    // Contenu principal
    Column {
        anchors.centerIn: parent
        spacing: Theme.spacingLarge

        // Titre du jeu
        Column {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Theme.spacingSmall

            // Emoji épées
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "⚔️"
                font.pixelSize: 64
            }

            // Titre principal
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "CLICKWARS"
                color: Theme.textPrimary
                font.pixelSize: Theme.fontHuge
                font.bold: true
                font.letterSpacing: 4

                // Animation de pulsation
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

            // Sous-titre
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "TERRITORY"
                color: Theme.teamA
                font.pixelSize: Theme.fontXLarge
                font.bold: true
                font.letterSpacing: 8
            }

            // Tagline
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Cliquez ensemble, conquérez ensemble !"
                color: Theme.textSecondary
                font.pixelSize: Theme.fontNormal
                font.italic: true

                topPadding: Theme.spacingMedium
            }
        }

        // Espace
        Item {
            width: 1
            height: Theme.spacingXLarge
        }

        // Boutons du menu
        Column {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Theme.spacingMedium

            // Bouton Créer Partie
            AnimatedButton {
                width: Theme.buttonWidthLarge
                height: Theme.buttonHeight
                text: "Créer Partie"
                buttonColor: Theme.teamA

                onClicked: mainMenu.navigateTo("lobby")
            }

            // Bouton Rejoindre Partie
            AnimatedButton {
                width: Theme.buttonWidthLarge
                height: Theme.buttonHeight
                text: "Rejoindre Partie"
                buttonColor: Theme.teamB

                onClicked: mainMenu.navigateTo("browser")
            }

            // Espace avant Quitter
            Item {
                width: 1
                height: Theme.spacingSmall
            }

            // Bouton Quitter
            AnimatedButton {
                width: Theme.buttonWidthLarge
                height: Theme.buttonHeight
                text: "Quitter"
                buttonColor: Theme.buttonDefault

                onClicked: mainMenu.navigateTo("quit")
            }
        }
    }

    // Version en bas
    Text {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: Theme.spacingMedium

        text: "v1.0.0 | Qt 6.8.3 + Felgo 4.0"
        color: Theme.textMuted
        font.pixelSize: Theme.fontTiny
    }

    // Décorations latérales (barres de couleur équipe)
    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 8

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
        width: 8

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
}
