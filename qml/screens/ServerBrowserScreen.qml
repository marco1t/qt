/**
 * ServerBrowserScreen.qml - Écran de recherche de serveurs
 *
 * Permet de rejoindre une partie en entrant l'IP du serveur.
 * Affiche également les serveurs récemment utilisés.
 */

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtCore
import Qt.labs.settings

import "../styles"
import "../components"

Rectangle {
    id: root

    signal backToMenu
    signal joinServer(string ip, int port, string sessionCode)

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

    // Serveurs récents (stockés localement)
    property var recentServers: []

    Component.onCompleted: {
        loadRecentServers();
    }

    // Charger les serveurs récents depuis le LocalStorage
    function loadRecentServers() {
        var stored = JSON.parse(localStorage.getItem("recentServers") || "[]");
        recentServers = stored;
    }

    // Sauvegarder un serveur récent
    function addRecentServer(ip, port) {
        var server = {
            ip: ip,
            port: port,
            lastUsed: Date.now()
        };

        // Retirer si déjà présent
        recentServers = recentServers.filter(function (s) {
            return s.ip !== ip || s.port !== port;
        });

        // Ajouter en première position
        recentServers.unshift(server);

        // Garder max 5 serveurs
        if (recentServers.length > 5) {
            recentServers = recentServers.slice(0, 5);
        }

        localStorage.setItem("recentServers", JSON.stringify(recentServers));
    }

    // Contenu principal
    ColumnLayout {
        anchors.centerIn: parent
        anchors.margins: 40
        spacing: 30
        width: Math.min(600, parent.width - 80)

        // Titre
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "🌐 Rejoindre une Partie"
            color: Theme.textPrimary
            font.pixelSize: 42
            font.bold: true

            SequentialAnimation on scale {
                loops: Animation.Infinite
                NumberAnimation {
                    to: 1.03
                    duration: 2000
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: 1.0
                    duration: 2000
                    easing.type: Easing.InOutSine
                }
            }
        }

        // Sous-titre
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Entrez l'adresse IP du serveur"
            color: Theme.textSecondary
            font.pixelSize: 18
        }

        Item {
            Layout.preferredHeight: 20
        }

        // Formulaire de connexion
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 300
            color: Qt.rgba(0, 0, 0, 0.3)
            radius: 12
            border.color: Theme.teamA
            border.width: 2

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 30
                spacing: 20

                // Champ IP
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8

                    Text {
                        text: "Adresse IP du serveur"
                        color: Theme.textPrimary
                        font.pixelSize: 16
                        font.bold: true
                    }

                    TextField {
                        id: ipInput
                        Layout.fillWidth: true
                        placeholderText: "Ex: 192.168.1.100"
                        text: "127.0.0.1"
                        font.pixelSize: 18
                        color: Theme.textPrimary
                        background: Rectangle {
                            color: Theme.backgroundDark
                            radius: 6
                            border.color: ipInput.activeFocus ? Theme.teamA : "#34495E"
                            border.width: 2
                        }

                        // Suppression du validateur strict pour permettre les noms de domaine (comme .com)

                        onAccepted: connectButton.clicked()
                    }
                }

                // Champ Port
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8

                    Text {
                        text: "Port"
                        color: Theme.textPrimary
                        font.pixelSize: 16
                        font.bold: true
                    }

                    TextField {
                        id: portInput
                        Layout.fillWidth: true
                        placeholderText: "7777"
                        text: "7777"
                        font.pixelSize: 18
                        color: Theme.textPrimary
                        background: Rectangle {
                            color: Theme.backgroundDark
                            radius: 6
                            border.color: portInput.activeFocus ? Theme.teamA : "#34495E"
                            border.width: 2
                        }

                        validator: IntValidator {
                            bottom: 1024
                            top: 65535
                        }

                        onAccepted: connectButton.clicked()
                    }
                }

                // Code session
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8

                    Text {
                        text: "Code session"
                        color: Theme.textPrimary
                        font.pixelSize: 16
                        font.bold: true
                    }

                    TextField {
                        id: sessionInput
                        Layout.fillWidth: true
                        placeholderText: "default"
                        text: "default"
                        font.pixelSize: 18
                        color: Theme.textPrimary
                        background: Rectangle {
                            color: Theme.backgroundDark
                            radius: 6
                            border.color: sessionInput.activeFocus ? Theme.teamA : "#34495E"
                            border.width: 2
                        }

                        onAccepted: connectButton.clicked()
                    }
                }
            }
        }

        // Bouton Connexion
        AnimatedButton {
            id: connectButton
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 250
            Layout.preferredHeight: 60
            text: "🎮 Se Connecter"
            buttonColor: Theme.success

            onClicked: {
                var ip = ipInput.text.trim();
                var port = parseInt(portInput.text) || 7777;
                var sessionCode = sessionInput.text.trim() || "default";

                if (ip.length === 0) {
                    console.warn("IP vide");
                    return;
                }

                // Ajouter aux serveurs récents
                addRecentServer(ip, port);

                // Émettre le signal
                root.joinServer(ip, port, sessionCode);
            }
        }

        // Séparateur
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 2
            color: "#34495E"
            Layout.topMargin: 20
            Layout.bottomMargin: 10
        }

        // Liste des serveurs récents
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 15
            visible: recentServers.length > 0

            Text {
                text: "⏱️ Serveurs récents"
                color: Theme.textPrimary
                font.pixelSize: 20
                font.bold: true
            }

            ListView {
                Layout.fillWidth: true
                Layout.preferredHeight: Math.min(recentServers.length * 60, 200)
                model: recentServers
                spacing: 10
                clip: true

                delegate: Rectangle {
                    width: ListView.view.width
                    height: 50
                    color: serverMouseArea.containsMouse ? Theme.teamADark : Qt.rgba(0, 0, 0, 0.2)
                    radius: 8
                    border.color: Theme.teamA
                    border.width: 1

                    Behavior on color {
                        ColorAnimation {
                            duration: 200
                        }
                    }

                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 15
                        spacing: 15

                        Text {
                            text: "🖥️"
                            font.pixelSize: 24
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2

                            Text {
                                text: modelData.ip + ":" + modelData.port
                                color: Theme.textPrimary
                                font.pixelSize: 16
                                font.bold: true
                            }

                            Text {
                                text: "Dernière connexion: " + getTimeAgo(modelData.lastUsed)
                                color: Theme.textSecondary
                                font.pixelSize: 12
                            }
                        }

                        Text {
                            text: "→"
                            color: Theme.teamA
                            font.pixelSize: 24
                            font.bold: true
                        }
                    }

                    MouseArea {
                        id: serverMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor

                        onClicked: {
                            ipInput.text = modelData.ip;
                            portInput.text = modelData.port.toString();
                            connectButton.clicked();
                        }
                    }
                }
            }
        }

        // Spacer
        Item {
            Layout.fillHeight: true
        }

        // Bouton Retour
        AnimatedButton {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 200
            text: "← Retour"
            buttonColor: Theme.buttonDefault

            onClicked: root.backToMenu()
        }
    }

    // Aide pour le temps écoulé
    function getTimeAgo(timestamp) {
        var seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60)
            return "Il y a quelques secondes";
        if (seconds < 3600)
            return "Il y a " + Math.floor(seconds / 60) + " min";
        if (seconds < 86400)
            return "Il y a " + Math.floor(seconds / 3600) + " h";
        return "Il y a " + Math.floor(seconds / 86400) + " j";
    }

    // Objet localStorage simulé (car QML n'a pas localStorage natif)
    QtObject {
        id: localStorage

        function getItem(key) {
            // Utiliser Settings pour la persistance
            return settings.value(key, "");
        }

        function setItem(key, value) {
            settings.setValue(key, value);
        }
    }

    // Settings pour la persistance
    Settings {
        id: settings
        category: "ServerBrowser"
    }
}
