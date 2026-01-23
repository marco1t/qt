/**
 * Theme.qml - Design System pour ClickWars: Territory
 *
 * Singleton QML contenant toutes les constantes de design :
 * couleurs, dimensions, animations, polices.
 *
 * Usage: import "styles" puis Theme.propertyName
 */

pragma Singleton
import QtQuick

QtObject {
    id: theme

    // ==========================================
    // COULEURS PRINCIPALES
    // ==========================================

    // Fond
    readonly property color background: "#1A1A2E"
    readonly property color backgroundLight: "#16213E"
    readonly property color backgroundDark: "#0F0F1A"

    // Équipe A (Rouge/Orange)
    readonly property color teamA: "#E74C3C"
    readonly property color teamALight: "#F39C12"
    readonly property color teamADark: "#C0392B"

    // Équipe B (Bleu/Cyan)
    readonly property color teamB: "#3498DB"
    readonly property color teamBLight: "#1ABC9C"
    readonly property color teamBDark: "#2980B9"

    // Texte
    readonly property color textPrimary: "#FFFFFF"
    readonly property color textSecondary: "#BDC3C7"
    readonly property color textMuted: "#7F8C8D"

    // Accents
    readonly property color success: "#2ECC71"
    readonly property color warning: "#F1C40F"
    readonly property color danger: "#E74C3C"
    readonly property color info: "#3498DB"

    // UI Elements
    readonly property color buttonDefault: "#34495E"
    readonly property color buttonHover: "#4A6278"
    readonly property color buttonPressed: "#2C3E50"
    readonly property color border: "#4A5568"

    // ==========================================
    // DIMENSIONS
    // ==========================================

    // Espacements
    readonly property int spacingTiny: 4
    readonly property int spacingSmall: 8
    readonly property int spacingMedium: 16
    readonly property int spacingLarge: 24
    readonly property int spacingXLarge: 32
    readonly property int spacingXXLarge: 48

    // Rayons
    readonly property int radiusSmall: 4
    readonly property int radiusMedium: 8
    readonly property int radiusLarge: 16
    readonly property int radiusRound: 9999

    // Boutons
    readonly property int buttonHeight: 56
    readonly property int buttonWidthSmall: 120
    readonly property int buttonWidthMedium: 200
    readonly property int buttonWidthLarge: 280

    // Jauges
    readonly property int gaugeHeight: 50
    readonly property int gaugeMaxWidth: 500

    // ==========================================
    // TYPOGRAPHIE
    // ==========================================

    // Tailles de police
    readonly property int fontTiny: 12
    readonly property int fontSmall: 14
    readonly property int fontNormal: 18
    readonly property int fontLarge: 24
    readonly property int fontXLarge: 32
    readonly property int fontTitle: 48
    readonly property int fontHuge: 64

    // Poids
    readonly property int fontWeightNormal: Font.Normal
    readonly property int fontWeightMedium: Font.Medium
    readonly property int fontWeightBold: Font.Bold

    // ==========================================
    // ANIMATIONS
    // ==========================================

    // Durées (ms)
    readonly property int animInstant: 50
    readonly property int animFast: 100
    readonly property int animNormal: 200
    readonly property int animSlow: 300
    readonly property int animVerySlow: 500

    // Easing par défaut
    readonly property int easingType: Easing.OutCubic

    // ==========================================
    // OMBRES & EFFETS
    // ==========================================

    // Opacités
    readonly property real opacityDisabled: 0.5
    readonly property real opacityOverlay: 0.8
    readonly property real opacitySubtle: 0.3

    // ==========================================
    // HELPERS
    // ==========================================

    // Fonction pour obtenir la couleur d'équipe
    function getTeamColor(team) {
        return team === "A" ? teamA : teamB;
    }

    function getTeamLightColor(team) {
        return team === "A" ? teamALight : teamBLight;
    }

    function getTeamName(team) {
        return team === "A" ? "Équipe A" : "Équipe B";
    }
}
