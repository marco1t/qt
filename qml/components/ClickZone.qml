/**
 * ClickZone.qml - Zone de clic interactive
 *
 * Le cœur du gameplay : chaque clic incrémente la jauge de l'équipe.
 * Affiche un feedback visuel et compte les clics du joueur.
 *
 * Propriétés:
 * - teamColor: Couleur de l'équipe du joueur
 * - enabled: Si les clics sont acceptés
 * - clickCount: Nombre de clics réussis
 *
 * Signaux:
 * - clicked(x, y): Émis à chaque clic réussi avec coordonnées
 */

import QtQuick

import "../styles"

Rectangle {
    id: clickZone

    // ==========================================
    // PROPRIÉTÉS
    // ==========================================

    // Couleur de l'équipe du joueur
    property color teamColor: Theme.teamA

    // Zone active ou non
    property bool clickEnabled: true

    // Compteur de clics du joueur
    property int clickCount: 0

    // Référence au GameState (passé par le parent)
    property var gameState: null

    // Référence au NetworkManager (optionnel, pour le multijoueur)
    property var network: null

    // Équipe du joueur local
    property string playerTeam: "A"

    // ID du joueur local (pour le réseau)
    property string localPlayerId: ""

    // ==========================================
    // SIGNAUX
    // ==========================================

    signal clicked(real x, real y)
    signal clickRejected

    // ==========================================
    // APPARENCE
    // ==========================================

    width: 220
    height: 220
    radius: width / 2  // Cercle parfait

    color: teamColor
    border.color: Qt.lighter(teamColor, 1.4)
    border.width: 6

    // Ombre portée (cercle derrière)
    Rectangle {
        anchors.centerIn: parent
        anchors.verticalCenterOffset: 8
        width: parent.width
        height: parent.height
        radius: parent.radius
        color: Qt.darker(clickZone.teamColor, 1.8)
        z: -1
        opacity: mouseArea.pressed ? 0 : 0.5
    }

    // Effet de glow
    Rectangle {
        anchors.centerIn: parent
        width: parent.width + 20
        height: parent.height + 20
        radius: width / 2
        color: "transparent"
        border.color: clickZone.teamColor
        border.width: 3
        opacity: 0.4
        z: -2

        // Pulsation
        SequentialAnimation on opacity {
            loops: Animation.Infinite
            NumberAnimation {
                to: 0.2
                duration: 800
                easing.type: Easing.InOutSine
            }
            NumberAnimation {
                to: 0.4
                duration: 800
                easing.type: Easing.InOutSine
            }
        }
    }

    // Contenu de la zone
    Column {
        anchors.centerIn: parent
        spacing: 8

        // Emoji main qui pointe
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "👆"
            font.pixelSize: 56

            // Animation légère
            SequentialAnimation on scale {
                loops: Animation.Infinite
                NumberAnimation {
                    to: 1.1
                    duration: 600
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: 1.0
                    duration: 600
                    easing.type: Easing.InOutSine
                }
            }
        }

        // Texte
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "CLIQUEZ!"
            color: "white"
            font.pixelSize: 22
            font.bold: true
            font.letterSpacing: 2

            // Effet d'ombre
            style: Text.Outline
            styleColor: Qt.darker(clickZone.teamColor, 1.5)
        }
    }

    // ==========================================
    // INTERACTION
    // ==========================================

    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: clickZone.clickEnabled

        onPressed: function (mouse) {
            handleClick(mouse.x, mouse.y);
        }
    }

    // Gestion du clic
    function handleClick(x, y) {
        if (!clickEnabled) {
            clickRejected();
            return;
        }

        if (!gameState) {
            console.warn("ClickZone: gameState non défini");
            return;
        }

        // Mode réseau : envoyer au serveur
        if (network && network.isConnected && localPlayerId) {
            network.sendClick(localPlayerId);

            // Feedback optimiste immédiat (avant confirmation serveur)
            clickCount++;
            bounceAnimation.start();
            clicked(x, y);

            console.log("Click #" + clickCount + " envoyé au serveur");
        } else
        // Mode local : incrémenter directement
        {
            var success = gameState.incrementGauge(playerTeam);

            if (success) {
                // Incrémenter le compteur local
                clickCount++;

                // Lancer l'animation de feedback
                bounceAnimation.start();

                // Émettre le signal avec les coordonnées
                clicked(x, y);

                // Log pour debug
                console.log("Click #" + clickCount + " pour équipe " + playerTeam);
            } else {
                // Jauge pleine ou partie terminée
                clickRejected();
                rejectAnimation.start();
            }
        }
    }

    // ==========================================
    // ANIMATIONS
    // ==========================================

    // Animation de rebond au clic réussi
    SequentialAnimation {
        id: bounceAnimation

        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.15
            duration: 50
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.0
            duration: 100
            easing.type: Easing.InOutQuad
        }
    }

    // Animation de rejet (jauge pleine)
    SequentialAnimation {
        id: rejectAnimation

        ColorAnimation {
            target: clickZone
            property: "color"
            to: Theme.danger
            duration: 100
        }
        ColorAnimation {
            target: clickZone
            property: "color"
            to: clickZone.teamColor
            duration: 200
        }
    }

    // Animation idle (pulsation douce quand pas de clic)
    SequentialAnimation on scale {
        id: idleAnimation
        loops: Animation.Infinite
        running: !bounceAnimation.running

        NumberAnimation {
            to: 1.03
            duration: 1000
            easing.type: Easing.InOutSine
        }
        NumberAnimation {
            to: 1.0
            duration: 1000
            easing.type: Easing.InOutSine
        }
    }

    // ==========================================
    // ÉTATS
    // ==========================================

    states: [
        State {
            name: "disabled"
            when: !clickEnabled
            PropertyChanges {
                target: clickZone
                opacity: 0.5
            }
        },
        State {
            name: "pressed"
            when: mouseArea.pressed
            PropertyChanges {
                target: clickZone
                border.width: 8
            }
        }
    ]

    transitions: [
        Transition {
            NumberAnimation {
                properties: "opacity, border.width"
                duration: 150
            }
        }
    ]
}
