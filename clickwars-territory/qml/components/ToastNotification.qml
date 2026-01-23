import QtQuick 2.15

/**
 * ToastNotification.qml
 *
 * Composant de notification toast qui s'affiche temporairement
 * en haut de l'écran avec animation d'entrée/sortie.
 *
 * Usage: Placer ce composant en DEHORS des Layouts, directement
 * dans un Item/Rectangle parent avec anchors.fill: parent
 */
Item {
    id: toastContainer

    // Propriétés publiques
    property int duration: 3000           // Durée d'affichage en ms
    property color backgroundColor: "#2C3E50"
    property color textColor: "white"
    property int fontSize: 16

    // Position: centré en haut
    width: parent ? parent.width : 400
    height: 70
    x: 0
    y: 20
    z: 9999  // Toujours au-dessus de tout

    // Liste des toasts à afficher (file d'attente)
    property var toastQueue: []
    property bool isShowing: false

    // Rectangle du toast
    Rectangle {
        id: toastRect

        width: Math.min(toastContainer.width * 0.9, toastText.implicitWidth + 80)
        height: 50
        x: (toastContainer.width - width) / 2  // Centré horizontalement
        y: toastContainer.isShowing ? 0 : -60  // Animation slide depuis le haut

        color: backgroundColor
        radius: 25
        opacity: toastContainer.isShowing ? 1 : 0

        Behavior on y {
            NumberAnimation {
                duration: 300
                easing.type: Easing.OutBack
            }
        }
        Behavior on opacity {
            NumberAnimation {
                duration: 200
            }
        }

        // Icône
        Text {
            id: iconText
            anchors.left: parent.left
            anchors.leftMargin: 20
            anchors.verticalCenter: parent.verticalCenter
            text: "ℹ️"
            font.pixelSize: fontSize + 4
        }

        // Message
        Text {
            id: toastText
            anchors.left: iconText.right
            anchors.leftMargin: 10
            anchors.right: parent.right
            anchors.rightMargin: 20
            anchors.verticalCenter: parent.verticalCenter

            text: ""
            color: textColor
            font.pixelSize: fontSize
            font.bold: false
            elide: Text.ElideRight
            maximumLineCount: 1
        }

        // Timer pour auto-hide
        Timer {
            id: hideTimer
            interval: toastContainer.duration
            onTriggered: {
                toastContainer.isShowing = false;
                // Traiter la prochaine notification après l'animation
                nextTimer.start();
            }
        }

        Timer {
            id: nextTimer
            interval: 350  // Attendre la fin de l'animation
            onTriggered: processQueue()
        }
    }

    /**
     * Affiche un toast avec le message donné
     * @param message - Le message à afficher
     * @param icon - (optionnel) L'icône à afficher
     */
    function show(message, icon) {
        console.log("🔔 Toast.show():", message);
        toastQueue.push({
            message: message,
            icon: icon || "ℹ️"
        });
        processQueue();
    }

    /**
     * Affiche un toast de type "succès"
     */
    function showSuccess(message) {
        show(message, "✅");
    }

    /**
     * Affiche un toast de type "erreur"
     */
    function showError(message) {
        show(message, "❌");
    }

    /**
     * Affiche un toast de type "warning"
     */
    function showWarning(message) {
        show(message, "⚠️");
    }

    /**
     * Affiche un toast pour un joueur qui quitte
     */
    function showPlayerLeft(playerName) {
        show(playerName + " a quitté la partie", "👋");
    }

    // Traite la file d'attente
    function processQueue() {
        if (isShowing || toastQueue.length === 0) {
            return;
        }

        var toast = toastQueue.shift();
        console.log("🔔 Toast processing:", toast.message);

        iconText.text = toast.icon;
        toastText.text = toast.message;

        isShowing = true;
        hideTimer.start();
    }
}
