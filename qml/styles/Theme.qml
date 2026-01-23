/**
 * Theme.qml - Design System
 *
 * Singleton contenant toutes les constantes de design.
 */

pragma Singleton
import QtQuick

QtObject {
    // Couleurs de fond
    readonly property color background: "#1A1A2E"
    readonly property color backgroundLight: "#16213E"
    readonly property color backgroundDark: "#0F0F1A"

    // Équipe A (Rouge)
    readonly property color teamA: "#E74C3C"
    readonly property color teamALight: "#F39C12"
    readonly property color teamADark: "#C0392B"

    // Équipe B (Bleu)
    readonly property color teamB: "#3498DB"
    readonly property color teamBLight: "#1ABC9C"
    readonly property color teamBDark: "#2980B9"

    // Texte
    readonly property color textPrimary: "#FFFFFF"
    readonly property color textSecondary: "#BDC3C7"
    readonly property color textMuted: "#7F8C8D"

    // Boutons
    readonly property color buttonDefault: "#34495E"
    readonly property color buttonHover: "#4A6278"

    // Accents
    readonly property color success: "#2ECC71"
    readonly property color warning: "#F1C40F"
    readonly property color danger: "#E74C3C"
}
