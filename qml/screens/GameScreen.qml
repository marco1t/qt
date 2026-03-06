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

    // Référence au NetworkManager (pour les clics)
    property var networkManager: null
    property string localPlayerId: ""

    // Configuration des joueurs (du lobby)
    property var players: []  // [{ id, name, team, isBot }]

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

    // Reset automatique du score local quand on revient au lobby
    Connections {
        target: gameState
        function onPhaseChanged() {
            if (gameState.phase === "lobby") {
               if (clickZone) clickZone.clickCount = 0;
            }
        }
    }

    // ==========================================
    // CONTRÔLEUR DE BOTS
    // ==========================================

    BotController {
        id: botController
        gameState: root.gameState

        onBotClicked: function (team, botId) {
        // console.log("Bot clic:", team, botId);
        }
    }

    // Timer de démarrage des bots (petit délai pour que tout soit prêt)
    Timer {
        id: botStartTimer
        interval: 500  // Attendre 500ms
        repeat: false
        running: true  // Démarre automatiquement

        onTriggered: {
            if (root.gameState && root.gameState.phase === "playing") {
                console.log("GameScreen: Configuration des bots depuis le lobby...");
                configureBots();
            }
        }
    }

    // Configurer les bots depuis la liste des joueurs du lobby
    function configureBots() {
        // Compter les bots par équipe
        var botsA = players.filter(p => p.isBot && p.team === "A").length;
        var botsB = players.filter(p => p.isBot && p.team === "B").length;

        console.log("Bots Équipe A:", botsA, "- Bots Équipe B:", botsB);

        if (botsA > 0 || botsB > 0) {
            botController.setupBots(botsA, "normal", botsB, "normal");
            botController.startBots();
        } else {
            console.log("Aucun bot configuré");
        }
    }

    // Arrêter les bots quand l'écran est détruit
    Component.onDestruction: {
        botController.cleanup();
    }

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
            Layout.preferredWidth: Math.min(parent.width * 0.9, 500)
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
            Layout.preferredWidth: Math.min(parent.width * 0.9, 500)
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

        // Zone de clic
        ClickZone {
            id: clickZone
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 220
            Layout.preferredHeight: 220

            // Connexion au GameState
            gameState: root.gameState

            // Connexion au Réseau (Story 3.1)
            network: root.networkManager
            localPlayerId: root.localPlayerId

            // Équipe du joueur
            playerTeam: gameState ? gameState.localPlayerTeam : "A"

            // Couleur selon l'équipe
            teamColor: {
                if (!gameState)
                    return Theme.teamA;
                return gameState.localPlayerTeam === "B" ? Theme.teamB : Theme.teamA;
            }

            // Désactiver si victoire
            clickEnabled: !root.showVictory

            // Signaux
            onClicked: function (x, y) {
                console.log("Clic à", x, y);
            }

            onClickRejected: {
                console.log("Clic rejeté - jauge pleine ou partie terminée");
            }
        }

        // Score du joueur
        Column {
            Layout.alignment: Qt.AlignHCenter
            spacing: 4

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Ton score"
                color: Theme.textMuted
                font.pixelSize: 14
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: clickZone.clickCount.toString()
                color: {
                    if (!gameState)
                        return Theme.textPrimary;
                    return gameState.localPlayerTeam === "B" ? Theme.teamB : Theme.teamA;
                }
                font.pixelSize: 42
                font.bold: true
            }
        }

        // Espace en bas
        Item {
            Layout.preferredHeight: 20
        }
    }

    // ==========================================
    // FLASH DE VICTOIRE
    // ==========================================
    Rectangle {
        id: victoryFlash
        anchors.fill: parent
        color: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
        opacity: 0
        z: 100  // Au-dessus de tout

        SequentialAnimation {
            id: flashAnimation
            loops: 2

            NumberAnimation {
                target: victoryFlash
                property: "opacity"
                from: 0
                to: 0.6
                duration: 100
                easing.type: Easing.OutQuad
            }
            NumberAnimation {
                target: victoryFlash
                property: "opacity"
                from: 0.6
                to: 0
                duration: 300
                easing.type: Easing.InQuad
            }
        }
    }

    // Déclencher l'animation flash à la victoire
    onShowVictoryChanged: {
        if (showVictory) {
            flashAnimation.start();
            botController.stopBots();
        }
    }

    // ==========================================
    // OVERLAY DE VICTOIRE
    // ==========================================
    Rectangle {
        id: victoryOverlay
        anchors.fill: parent
        visible: root.showVictory
        color: Qt.rgba(0, 0, 0, 0)
        z: 50

        // Animation d'apparition
        opacity: root.showVictory ? 1 : 0
        Behavior on opacity {
            NumberAnimation {
                duration: 400
                easing.type: Easing.OutCubic
            }
        }

        // Fond semi-transparent avec animation
        Rectangle {
            id: overlayBackground
            anchors.fill: parent
            color: "black"
            opacity: root.showVictory ? 0.85 : 0
            Behavior on opacity {
                NumberAnimation {
                    duration: 500
                    easing.type: Easing.OutCubic
                }
            }
        }

        // Contenu principal
        Column {
            id: victoryContent
            anchors.centerIn: parent
            spacing: 20

            // Animation de scale à l'apparition
            scale: root.showVictory ? 1 : 0.5
            Behavior on scale {
                NumberAnimation {
                    duration: 400
                    easing.type: Easing.OutBack
                }
            }

            // Titre
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "🏆 VICTOIRE! 🏆"
                color: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
                font.pixelSize: 56
                font.bold: true

                // Animation de pulsation
                SequentialAnimation on scale {
                    running: root.showVictory
                    loops: Animation.Infinite
                    NumberAnimation {
                        to: 1.05
                        duration: 800
                        easing.type: Easing.InOutQuad
                    }
                    NumberAnimation {
                        to: 1.0
                        duration: 800
                        easing.type: Easing.InOutQuad
                    }
                }
            }

            // Sous-titre équipe gagnante
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: gameState ? ("Équipe " + gameState.winner + " gagne!") : ""
                color: "white"
                font.pixelSize: 32
            }

            // Séparateur
            Rectangle {
                anchors.horizontalCenter: parent.horizontalCenter
                width: 200
                height: 2
                color: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
                opacity: 0.6
            }

            // Section des scores
            Column {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 8

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "📊 Scores Finaux"
                    color: Theme.textSecondary
                    font.pixelSize: 18
                    font.bold: true
                }

                // Score Équipe A
                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 10

                    Rectangle {
                        width: 12
                        height: 12
                        radius: 6
                        color: Theme.teamA
                        anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                        text: "Équipe A: " + (gameState ? gameState.teamAGauge : 0) + " pts"
                        color: gameState && gameState.winner === "A" ? Theme.teamA : Theme.textMuted
                        font.pixelSize: 16
                        font.bold: gameState && gameState.winner === "A"
                    }

                    Text {
                        visible: gameState && gameState.winner === "A"
                        text: "👑"
                        font.pixelSize: 16
                    }
                }

                // Score Équipe B
                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 10

                    Rectangle {
                        width: 12
                        height: 12
                        radius: 6
                        color: Theme.teamB
                        anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                        text: "Équipe B: " + (gameState ? gameState.teamBGauge : 0) + " pts"
                        color: gameState && gameState.winner === "B" ? Theme.teamB : Theme.textMuted
                        font.pixelSize: 16
                        font.bold: gameState && gameState.winner === "B"
                    }

                    Text {
                        visible: gameState && gameState.winner === "B"
                        text: "👑"
                        font.pixelSize: 16
                    }
                }

                // Score du joueur
                Item {
                    width: 1
                    height: 10
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Vos clics: " + clickZone.clickCount
                    color: Theme.textPrimary
                    font.pixelSize: 14
                }
            }

            // ==========================================
            // PANNEAU STATISTIQUES DE LATENCE
            // ==========================================
            LatencyStatsPanel {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: root.showVictory

                // Clics locaux (compteurs de la ClickZone du joueur)
                totalClicks:     clickZone.totalClicksLocal
                validatedClicks: clickZone.validatedClicksLocal
                // Prendre le max entre local et serveur (le serveur peut en avoir capté plus)
                rejectedClicks: Math.max(
                    clickZone.rejectedClicksLocal,
                    gameState ? gameState.rejectedClicksServer : 0
                )
            }

            // Espace avant les boutons
            Item {
                width: 1
                height: 20
            }


            // Boutons
            AnimatedButton {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "🔄 Rejouer"
                    buttonColor: gameState && gameState.winner === "A" ? Theme.teamA : Theme.teamB
                    onClicked: {
                        if (gameState) {
                            clickZone.totalClicksLocal    = 0;
                            clickZone.validatedClicksLocal = 0;
                            clickZone.rejectedClicksLocal  = 0;
                            clickZone.inLatencyWindow      = false;
                            gameState.resetGame();
                            // Redémarrer les bots après un délai
                            botRestartTimer.start();
                        }
                    }
                }

            AnimatedButton {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "🏠 Menu Principal"
                buttonColor: Theme.buttonDefault
                onClicked: root.backToMenu()
            }
        }
    }

    // Timer pour redémarrer les bots après Rejouer
    Timer {
        id: botRestartTimer
        interval: 500
        repeat: false
        onTriggered: {
            if (root.gameState && root.gameState.phase === "playing") {
                botController.setupBots(0, "normal", 2, "normal");
                botController.startBots();
            }
        }
    }

}
