/**
 * GaugeBar.qml - Composant de jauge d'équipe
 *
 * Affiche une barre de progression colorée pour une équipe.
 * Animée et connectée au GameState.
 *
 * Propriétés:
 * - value: Valeur actuelle (0-100)
 * - maxValue: Valeur maximale
 * - teamColor: Couleur de l'équipe
 * - teamName: Nom de l'équipe
 */

import QtQuick
import QtQuick.Layouts

import "../styles"

Rectangle {
    id: root

    // Propriétés publiques
    property real value: 0
    property real maxValue: 100
    property color teamColor: Theme.teamA
    property string teamName: "Équipe"
    property bool showLabel: true
    property bool isDanger: value >= (maxValue * 0.8)

    // Propriétés calculées
    property real progress: Math.min(value / maxValue, 1.0)
    property real animatedValue: 0

    // Dimensions
    width: 400
    height: 60
    radius: height / 2
    color: "#2C3E50"

    // Animation de la valeur
    Behavior on animatedValue {
        NumberAnimation {
            duration: 150
            easing.type: Easing.OutQuad
        }
    }

    // Sync value -> animatedValue
    onValueChanged: animatedValue = value

    // Barre de remplissage
    Rectangle {
        id: fill
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom

        width: parent.width * (root.animatedValue / root.maxValue)
        radius: parent.radius

        // Dégradé de couleur
        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop {
                position: 0.0
                color: root.teamColor
            }
            GradientStop {
                position: 1.0
                color: Qt.lighter(root.teamColor, 1.3)
            }
        }

        // Animation de pulsation en zone danger
        opacity: pulseOpacity
        property real pulseOpacity: 1.0

        SequentialAnimation on pulseOpacity {
            running: root.isDanger
            loops: Animation.Infinite

            NumberAnimation {
                to: 0.7
                duration: root.isDanger ? 200 : 600
                easing.type: Easing.InOutSine
            }
            NumberAnimation {
                to: 1.0
                duration: root.isDanger ? 200 : 600
                easing.type: Easing.InOutSine
            }
        }
    }

    // Contenu de la jauge
    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 20
        anchors.rightMargin: 20

        // Nom de l'équipe
        Text {
            visible: root.showLabel
            text: root.teamName.toUpperCase()
            color: "white"
            font.pixelSize: 16
            font.bold: true
            font.letterSpacing: 2
            Layout.alignment: Qt.AlignVCenter
        }

        // Spacer
        Item {
            Layout.fillWidth: true
        }

        // Valeur numérique
        Text {
            text: Math.floor(root.animatedValue) + "/" + Math.floor(root.maxValue)
            color: "white"
            font.pixelSize: 22
            font.bold: true
            Layout.alignment: Qt.AlignVCenter

            // Animation de scale en zone danger
            scale: root.isDanger ? dangerScale : 1.0
            property real dangerScale: 1.0

            SequentialAnimation on dangerScale {
                running: root.isDanger
                loops: Animation.Infinite

                NumberAnimation {
                    to: 1.1
                    duration: 200
                }
                NumberAnimation {
                    to: 1.0
                    duration: 200
                }
            }
        }
    }

    // Indicateur de zone danger (ligne blanche à droite)
    Rectangle {
        visible: root.isDanger
        anchors.right: fill.right
        anchors.rightMargin: 2
        anchors.verticalCenter: parent.verticalCenter
        width: 3
        height: parent.height - 10
        radius: 2
        color: "white"

        SequentialAnimation on opacity {
            running: root.isDanger
            loops: Animation.Infinite
            NumberAnimation {
                to: 0.3
                duration: 150
            }
            NumberAnimation {
                to: 1.0
                duration: 150
            }
        }
    }

    // Effet de glow externe (subtil)
    Rectangle {
        anchors.fill: parent
        anchors.margins: -4
        radius: parent.radius + 4
        color: "transparent"
        border.color: root.teamColor
        border.width: 2
        opacity: root.isDanger ? 0.6 : 0.2
        z: -1

        Behavior on opacity {
            NumberAnimation {
                duration: 200
            }
        }
    }
}
