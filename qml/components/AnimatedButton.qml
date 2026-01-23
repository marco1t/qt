/**
 * AnimatedButton.qml - Bouton avec animations
 *
 * Bouton réutilisable avec effets hover et press.
 */

import QtQuick
import QtQuick.Controls

import "../styles"

Rectangle {
    id: root

    property string text: "Button"
    property color buttonColor: Theme.buttonDefault
    property color textColor: Theme.textPrimary
    property bool buttonEnabled: true

    signal clicked

    width: 200
    height: 56
    radius: 8

    color: {
        if (!buttonEnabled)
            return Qt.darker(buttonColor, 1.5);
        if (mouseArea.pressed)
            return Qt.darker(buttonColor, 1.3);
        if (mouseArea.containsMouse)
            return Qt.lighter(buttonColor, 1.15);
        return buttonColor;
    }

    Behavior on color {
        ColorAnimation {
            duration: 100
        }
    }

    scale: mouseArea.pressed ? 0.96 : 1.0

    Behavior on scale {
        NumberAnimation {
            duration: 80
            easing.type: Easing.OutQuad
        }
    }

    // Ombre
    Rectangle {
        anchors.fill: parent
        anchors.topMargin: 4
        radius: parent.radius
        color: Qt.darker(root.buttonColor, 1.8)
        z: -1
        opacity: mouseArea.pressed ? 0 : 0.5
    }

    // Texte
    Text {
        anchors.centerIn: parent
        text: root.text
        color: root.buttonEnabled ? root.textColor : Theme.textMuted
        font.pixelSize: 18
        font.bold: true
        font.letterSpacing: 1
    }

    // Zone cliquable
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: root.buttonEnabled
        hoverEnabled: true
        cursorShape: buttonEnabled ? Qt.PointingHandCursor : Qt.ForbiddenCursor
        onClicked: if (root.buttonEnabled)
            root.clicked()
    }

    // État désactivé
    opacity: buttonEnabled ? 1.0 : 0.5
}
