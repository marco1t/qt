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

    // ==========================================
    // COMPTEURS DE CLICS (démo latence)
    // ==========================================
    // Alias pratique pour la compat. avec GameScreen.qml existant
    property int clickCount: validatedClicksLocal

    // Clics tentés au total (bouton appuyé)
    property int totalClicksLocal: 0
    // Clics qui ont bien incrémenté la jauge
    property int validatedClicksLocal: 0
    // Clics « dans le vide » (après victoire, pendant la latence)
    property int rejectedClicksLocal: 0

    // Référence au GameState (passé par le parent)
    property var gameState: null

    // Référence au NetworkManager (optionnel, pour le multijoueur)
    property var network: null

    // Équipe du joueur local
    property string playerTeam: "A"

    // ID du joueur local (pour le réseau)
    property string localPlayerId: ""

    // ==========================================
    // FENÊTRE DE LATENCE
    // ==========================================
    // Durée pendant laquelle on reste à l'écoute des clics après victoire
    property int latencyWindowMs: 1000
    // true = on est en train de vivre la seconde de latence
    property bool inLatencyWindow: false

    // ==========================================
    // SIGNAUX
    // ==========================================

    signal clicked(real x, real y)
    signal clickRejected
    // Émis quand un clic arrive pendant la fenêtre de latence (trop tard !)
    signal clickLate

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

    // ==========================================
    // TIMER : FENÊTRE DE LATENCE
    // ==========================================
    // Reste actif 1s après la victoire pour capter les clics tardifs
    Timer {
        id: latencyWindowTimer
        interval: clickZone.latencyWindowMs
        repeat: false
        onTriggered: {
            clickZone.inLatencyWindow = false;
            mouseArea.enabled = false;  // On coupe vraiment l'interaction
            console.log("ClickZone: Fenêtre de latence terminée ("
                        + clickZone.rejectedClicksLocal + " clics dans le vide)");
        }
    }

    // Réagir aux changements de phase du jeu
    Connections {
        target: gameState
        function onPhaseChanged() {
            if (gameState && gameState.phase === "victory") {
                // Ouvrir la fenêtre de latence : on garde le MouseArea actif
                clickZone.inLatencyWindow = true;
                mouseArea.enabled = true;   // Garder actif pour capter les clics tardifs
                latencyWindowTimer.restart();
                console.log("ClickZone: Victoire détectée — fenêtre latence ouverte");
            }
        }
    }

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
        if (!gameState) {
            console.warn("ClickZone: gameState non défini");
            return;
        }

        totalClicksLocal++;

        // ── CAS 1 : clic pendant la fenêtre de latence (partie terminée) ────
        if (inLatencyWindow || (gameState && gameState.phase === "victory")) {
            rejectedClicksLocal++;
            clickLate();
            lateAnimation.start();
            console.log("ClickZone: Clic TARDIF #" + rejectedClicksLocal + " — dans le vide !");
            return;
        }

        // ── CAS 2 : zone désactivée ──────────────────────────────────────────
        if (!clickEnabled) {
            clickRejected();
            return;
        }

        // ── CAS 3 : mode réseau ──────────────────────────────────────────────
        if (network && network.isConnected && localPlayerId) {
            network.sendClick(localPlayerId);

            // Feedback optimiste immédiat (avant confirmation serveur)
            validatedClicksLocal++;
            bounceAnimation.start();
            clicked(x, y);

            console.log("Click #" + validatedClicksLocal + " envoyé au serveur");
        } else {
            // ── CAS 4 : mode local ───────────────────────────────────────────
            var success = gameState.incrementGauge(playerTeam);

            if (success) {
                validatedClicksLocal++;
                bounceAnimation.start();
                clicked(x, y);
                console.log("Click #" + validatedClicksLocal + " pour équipe " + playerTeam);
            } else {
                // Jauge pleine (victoire pas encore propagée → traiter comme tardif)
                rejectedClicksLocal++;
                clickLate();
                lateAnimation.start();
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

    // ==========================================
    // ANIMATION "TROP TARD !" (clic pendant latence)
    // ==========================================
    // Flash orange vif + secousse pour rendre tangible la latence
    SequentialAnimation {
        id: lateAnimation

        // 1. Flash orange immédiat
        ColorAnimation {
            target: clickZone
            property: "color"
            to: "#FF6600"
            duration: 60
        }
        // 2. Petite secousse scale
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 0.90
            duration: 60
            easing.type: Easing.OutBack
        }
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.05
            duration: 80
            easing.type: Easing.InOutQuad
        }
        NumberAnimation {
            target: clickZone
            property: "scale"
            to: 1.0
            duration: 100
            easing.type: Easing.InOutQuad
        }
        // 3. Retour couleur normale
        ColorAnimation {
            target: clickZone
            property: "color"
            to: clickZone.teamColor
            duration: 200
        }
    }

    // Label "TROP TARD !" qui apparaît brièvement au-dessus du bouton
    Text {
        id: lateLabelText
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.top
        anchors.bottomMargin: 8
        text: "✋ TROP TARD !"
        color: "#FF6600"
        font.pixelSize: 18
        font.bold: true
        opacity: 0
        z: 10

        SequentialAnimation {
            id: lateLabelAnimation
            running: lateAnimation.running

            NumberAnimation {
                target: lateLabelText
                property: "opacity"
                from: 0
                to: 1.0
                duration: 80
            }
            PauseAnimation { duration: 500 }
            NumberAnimation {
                target: lateLabelText
                property: "opacity"
                from: 1.0
                to: 0
                duration: 250
            }
        }
    }

    // Animation idle (pulsation douce quand pas de clic)
    SequentialAnimation on scale {
        id: idleAnimation
        loops: Animation.Infinite
        running: !bounceAnimation.running && !lateAnimation.running

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
