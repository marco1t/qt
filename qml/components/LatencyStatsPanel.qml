/**
 * LatencyStatsPanel.qml - Panneau de statistiques de latence
 *
 * Affiché sur l'écran de victoire pour illustrer concrètement
 * l'impact de la latence réseau : combien de clics ont été effectués
 * "dans le vide" après que la partie s'est terminée côté serveur.
 *
 * Propriétés:
 *   totalClicks     - Nombre total de clics tentés
 *   validatedClicks - Clics ayant contribué à la jauge
 *   rejectedClicks  - Clics "dans le vide" (après victoire)
 */

import QtQuick
import QtQuick.Layouts

import "../styles"

Rectangle {
    id: root

    // ==========================================
    // PROPRIÉTÉS
    // ==========================================

    property int totalClicks: 0
    property int validatedClicks: 0
    property int rejectedClicks: 0

    // Délai d'animation à l'apparition (ms)
    property int appearDelay: 400

    // ==========================================
    // APPARENCE
    // ==========================================

    width: 340
    height: contentColumn.implicitHeight + 32
    radius: 16

    color: "transparent"
    border.color: Qt.rgba(1, 0.4, 0, 0.6)
    border.width: rejectedClicks > 0 ? 2 : 0

    // Fond dégradé sombre
    Rectangle {
        anchors.fill: parent
        radius: parent.radius
        gradient: Gradient {
            orientation: Gradient.Vertical
            GradientStop { position: 0.0; color: Qt.rgba(0.05, 0.05, 0.08, 0.92) }
            GradientStop { position: 1.0; color: Qt.rgba(0.10, 0.05, 0.05, 0.95) }
        }
    }

    // Animation d'apparition (scale + fade)
    opacity: 0
    scale: 0.8

    Timer {
        interval: root.appearDelay
        running: true
        repeat: false
        onTriggered: appearAnimation.start()
    }

    SequentialAnimation {
        id: appearAnimation
        ParallelAnimation {
            NumberAnimation {
                target: root
                property: "opacity"
                from: 0; to: 1.0
                duration: 350
                easing.type: Easing.OutCubic
            }
            NumberAnimation {
                target: root
                property: "scale"
                from: 0.8; to: 1.0
                duration: 350
                easing.type: Easing.OutBack
            }
        }
    }

    // ==========================================
    // CONTENU
    // ==========================================

    ColumnLayout {
        id: contentColumn
        anchors {
            left: parent.left; right: parent.right
            top: parent.top
            margins: 16
        }
        spacing: 12

        // ── En-tête ──────────────────────────────────────────────────────────
        Text {
            Layout.fillWidth: true
            text: "📡 Analyse de la Latence Réseau"
            color: "#aaaacc"
            font.pixelSize: 13
            font.bold: true
            font.letterSpacing: 1
            horizontalAlignment: Text.AlignHCenter
        }

        // ── Séparateur ───────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 1
            color: Qt.rgba(1, 1, 1, 0.1)
        }

        // ── Ligne : Clics validés ────────────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            Rectangle {
                width: 10; height: 10; radius: 5
                color: "#44dd88"
            }

            Text {
                Layout.fillWidth: true
                text: "Clics validés"
                color: "#aaaaaa"
                font.pixelSize: 14
            }

            Text {
                text: root.validatedClicks.toString()
                color: "#44dd88"
                font.pixelSize: 20
                font.bold: true
            }
        }

        // ── Ligne : Clics rejetés (LE CHIFFRE CLEF) ─────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: rejectedRow.implicitHeight + 14
            radius: 10
            color: root.rejectedClicks > 0 ? Qt.rgba(1, 0.2, 0, 0.18) : "transparent"
            border.color: root.rejectedClicks > 0 ? Qt.rgba(1, 0.4, 0, 0.5) : "transparent"
            border.width: 1

            RowLayout {
                id: rejectedRow
                anchors {
                    left: parent.left; right: parent.right
                    verticalCenter: parent.verticalCenter
                    margins: 10
                }
                spacing: 10

                // Icône d'alerte animée si des clics ont été rejetés
                Text {
                    text: root.rejectedClicks > 0 ? "👻" : "✅"
                    font.pixelSize: 20

                    SequentialAnimation on opacity {
                        loops: Animation.Infinite
                        running: root.rejectedClicks > 0
                        NumberAnimation { to: 0.4; duration: 600; easing.type: Easing.InOutSine }
                        NumberAnimation { to: 1.0; duration: 600; easing.type: Easing.InOutSine }
                    }
                }

                Column {
                    Layout.fillWidth: true
                    spacing: 1

                    Text {
                        text: "Clics dans le vide !"
                        color: root.rejectedClicks > 0 ? "#ff6622" : "#888888"
                        font.pixelSize: 14
                        font.bold: root.rejectedClicks > 0
                    }

                    Text {
                        visible: root.rejectedClicks > 0
                        text: "Envoyés après la fin de partie"
                        color: "#888888"
                        font.pixelSize: 10
                    }
                }

                // Le grand chiffre rouge
                Text {
                    text: root.rejectedClicks.toString()
                    color: root.rejectedClicks > 0 ? "#ff4400" : "#555555"
                    font.pixelSize: root.rejectedClicks > 0 ? 32 : 20
                    font.bold: true

                    // Petit "bump" à l'apparition
                    Behavior on font.pixelSize {
                        NumberAnimation { duration: 200; easing.type: Easing.OutBack }
                    }
                }
            }
        }

        // ── Barre de ratio validé / rejeté ───────────────────────────────────
        Column {
            Layout.fillWidth: true
            spacing: 4
            visible: root.totalClicks > 0

            RowLayout {
                width: parent.width

                Text {
                    text: "Ratio"
                    color: "#666688"
                    font.pixelSize: 11
                }
                Item { Layout.fillWidth: true }
                Text {
                    text: root.totalClicks > 0
                          ? Math.round(root.validatedClicks * 100 / root.totalClicks) + "% utiles"
                          : ""
                    color: "#aaaaaa"
                    font.pixelSize: 11
                }
            }

            // Barre de fond
            Rectangle {
                width: parent.width
                height: 8
                radius: 4
                color: Qt.rgba(1, 0.2, 0, 0.3)

                // Partie verte (validée)
                Rectangle {
                    anchors { left: parent.left; top: parent.top; bottom: parent.bottom }
                    radius: parent.radius
                    color: "#44dd88"
                    width: root.totalClicks > 0
                           ? parent.width * (root.validatedClicks / root.totalClicks)
                           : 0

                    Behavior on width {
                        NumberAnimation { duration: 600; easing.type: Easing.OutCubic }
                    }
                }
            }
        }

        // ── Note explicative ─────────────────────────────────────────────────
        Text {
            Layout.fillWidth: true
            visible: root.rejectedClicks > 0
            text: "⏱ La latence réseau (~1s) a causé " + root.rejectedClicks
                  + " clic" + (root.rejectedClicks > 1 ? "s" : "") + " inutile"
                  + (root.rejectedClicks > 1 ? "s" : "") + "."
            color: "#888888"
            font.pixelSize: 11
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
        }

        // Espace bas
        Item { height: 4 }
    }
}
