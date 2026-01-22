/**
 * AnimatedButton.qml - Bouton avec animations
 *
 * Bouton réutilisable avec effets hover et press.
 * Utilisé partout dans l'application.
 *
 * Propriétés:
 * - text: Texte du bouton
 * - buttonColor: Couleur de fond
 * - textColor: Couleur du texte (défaut: blanc)
 *
 * Signaux:
 * - clicked(): Émis au clic
 */

import QtQuick
import "../styles"

Rectangle {
    id: button

    // Propriétés publiques
    property string text: "Button"
    property color buttonColor: Theme.buttonDefault
    property color textColor: Theme.textPrimary
    property bool enabled: true

    // Signal
    signal clicked

    // Dimensions par défaut
    width: Theme.buttonWidthMedium
    height: Theme.buttonHeight
    radius: Theme.radiusMedium

    // Couleur dynamique selon l'état
    color: {
        if (!enabled)
            return Qt.darker(buttonColor, 1.5);
        if (mouseArea.pressed)
            return Qt.darker(buttonColor, 1.3);
        if (mouseArea.containsMouse)
            return Qt.lighter(buttonColor, 1.15);
        return buttonColor;
    }

    // Animation de couleur
    Behavior on color {
        ColorAnimation {
            duration: Theme.animFast
            easing.type: Theme.easingType
        }
    }

    // Animation de scale
    scale: mouseArea.pressed ? 0.96 : 1.0

    Behavior on scale {
        NumberAnimation {
            duration: Theme.animFast
            easing.type: Easing.OutQuad
        }
    }

    // Effet d'ombre
    Rectangle {
        anchors.fill: parent
        anchors.topMargin: 4
        radius: parent.radius
        color: Qt.darker(button.buttonColor, 1.8)
        z: -1

        opacity: mouseArea.pressed ? 0 : 0.5

        Behavior on opacity {
            NumberAnimation {
                duration: Theme.animFast
            }
        }
    }

    // Texte du bouton
    Text {
        anchors.centerIn: parent
        text: button.text
        color: button.enabled ? button.textColor : Theme.textMuted
        font.pixelSize: Theme.fontNormal
        font.bold: true
        font.letterSpacing: 1
    }

    // Zone cliquable
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: button.enabled
        hoverEnabled: true
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ForbiddenCursor

        onClicked: {
            if (button.enabled) {
                button.clicked();
            }
        }
    }

    // États visuels pour accessibilité
    states: [
        State {
            name: "disabled"
            when: !button.enabled
            PropertyChanges {
                target: button
                opacity: Theme.opacityDisabled
            }
        }
    ]
}
