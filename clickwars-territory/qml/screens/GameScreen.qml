/**
 * GameScreen.qml - Écran de jeu principal
 *
 * Affiche les jauges des deux équipes et la zone de clic.
 * Se connecte au GameState pour les mises à jour en temps réel.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import "../styles"
import "../components"

Rectangle {
    id: root

    // Référence au GameStateManager (passé par le parent)
    property var gameState: null

    // Propriété calculée pour afficher la victoire
    property bool showVictory: {
        if (!gameState)
            return false;
        if (gameState.phase !== "victory")
            return false;
        if (gameState.winner === "")
            return false;
        return true;
    }

    // Signal pour retourner au menu
    signal backToMenu

    // Fond dégradé
    gradient: Gradient {
        GradientStop {
            position: 0.0
            color: Theme.backgroundDark
        }
        GradientStop {
            position: 0.5
            color: Theme.background
        }
        GradientStop {
            position: 1.0
            color: Theme.backgroundDark
        }
    }

    // Layout principal
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 40
        spacing: 20

        // En-tête avec titre du territoire
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 60

            // Bouton retour
            AnimatedButton {
                Layout.preferredWidth: 100
                Layout.preferredHeight: 40
                text: "← Menu"
                buttonColor: Theme.buttonDefault
                onClicked: root.backToMenu()
            }

            Item {
                Layout.fillWidth: true
            }

            // Titre du territoire
            Column {
                Layout.alignment: Qt.AlignHCenter

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "🏰"
                    font.pixelSize: 32
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: gameState ? gameState.territoryName : "Territoire 1"
                    color: Theme.textPrimary
                    font.pixelSize: 28
                    font.bold: true
                    font.letterSpacing: 2
                }
            }

            Item {
                Layout.fillWidth: true
            }

            // Placeholder pour équilibrer le layout
            Item {
                Layout.preferredWidth: 100
                Layout.preferredHeight: 40
            }
        }

        // Espace
        Item {
            Layout.preferredHeight: 20
        }

        // Jauge Équipe A
        GaugeBar {
            id: gaugeA
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: Math.min(parent.width * 0.8, 500)
            Layout.preferredHeight: 60

            teamName: "Équipe A"
            teamColor: Theme.teamA
            value: gameState ? gameState.teamAGauge : 0
            maxValue: gameState ? gameState.maxGauge : 100
        }

        // VS au centre
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "⚔️ VS ⚔️"
            color: Theme.textSecondary
            font.pixelSize: 24
            font.bold: true

            // Animation de pulsation légère
            SequentialAnimation on scale {
                loops: Animation.Infinite
                NumberAnimation {
                    to: 1.05
                    duration: 1000
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: 1.0
                    duration: 1000
                    easing.type: Easing.InOutSine
                }
            }
        }

        // Jauge Équipe B
        GaugeBar {
            id: gaugeB
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: Math.min(parent.width * 0.8, 500)
            Layout.preferredHeight: 60

            teamName: "Équipe B"
            teamColor: Theme.teamB
            value: gameState ? gameState.teamBGauge : 0
            maxValue: gameState ? gameState.maxGauge : 100
        }

        // Espace flexible
        Item {
            Layout.fillHeight: true
        }

        // Zone de clic (placeholder pour Story 1.5)
        Rectangle {
            id: clickZonePlaceholder
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 200
            Layout.preferredHeight: 200

            radius: width / 2
            color: Theme.teamA  // TODO: Couleur selon l'équipe du joueur
            border.color: Qt.lighter(Theme.teamA, 1.3)
            border.width: 4

            // Texte
            Column {
                anchors.centerIn: parent
                spacing: 8

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "👆"
                    font.pixelSize: 48
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "CLIQUEZ!"
                    color: "white"
                    font.pixelSize: 20
                    font.bold: true
                }
            }

            // Animation de pulsation
            SequentialAnimation on scale {
                loops: Animation.Infinite
                NumberAnimation {
                    to: 1.05
                    duration: 800
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: 1.0
                    duration: 800
                    easing.type: Easing.InOutSine
                }
            }

            // Zone cliquable (test)
            MouseArea {
                anchors.fill: parent
                onClicked: {
                    if (gameState) {
                        // Test: incrémente équipe A
                        gameState.incrementGauge("A");

                        // Animation de feedback
                        clickFeedback.start();
                    }
                }
            }

            // Animation de feedback au clic
            SequentialAnimation {
                id: clickFeedback

                NumberAnimation {
                    target: clickZonePlaceholder
                    property: "scale"
                    to: 1.15
                    duration: 50
                    easing.type: Easing.OutQuad
                }
                NumberAnimation {
                    target: clickZonePlaceholder
                    property: "scale"
                    to: 1.0
                    duration: 100
                    easing.type: Easing.InOutQuad
                }
            }
        }

        // Score du joueur
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Ton score: " + (gameState ? gameState.localPlayerScore : 0)
            color: Theme.textSecondary
            font.pixelSize: 20
        }

        // Espace en bas
        Item {
            Layout.preferredHeight: 20
        }
    }

    // Overlay de victoire
    Rectangle {
        id: victoryOverlay
        anchors.fill: parent
        visible: root.showVictory
        color: Qt.rgba(0, 0, 0, 0.85)

        Column {
            anchors.centerIn: parent
            spacing: 20

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "🏆 VICTOIRE! 🏆"
                color: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
                font.pixelSize: 56
                font.bold: true
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: gameState ? ("Équipe " + gameState.winner + " gagne!") : ""
                color: "white"
                font.pixelSize: 32
            }

            Item {
                height: 20
                width: 1
            }

            AnimatedButton {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Rejouer"
                buttonColor: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
                onClicked: {
                    if (gameState) {
                        gameState.resetGame();
                    }
                }
            }

            AnimatedButton {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Menu Principal"
                buttonColor: Theme.buttonDefault
                onClicked: root.backToMenu()
            }
        }
    }

    // Debug: Boutons de test (à retirer plus tard)
    Row {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 10
        spacing: 10
        visible: true  // Mettre false en production

        AnimatedButton {
            width: 80
            height: 30
            text: "A +10"
            buttonColor: Theme.teamA
            onClicked: {
                if (gameState) {
                    for (var i = 0; i < 10; i++) {
                        gameState.incrementGauge("A");
                    }
                }
            }
        }

        AnimatedButton {
            width: 80
            height: 30
            text: "B +10"
            buttonColor: Theme.teamB
            onClicked: {
                if (gameState) {
                    for (var i = 0; i < 10; i++) {
                        gameState.incrementGauge("B");
                    }
                }
            }
        }

        AnimatedButton {
            width: 80
            height: 30
            text: "Reset"
            buttonColor: Theme.buttonDefault
            onClicked: {
                if (gameState) {
                    gameState.resetGame();
                }
            }
        }
    }
}
