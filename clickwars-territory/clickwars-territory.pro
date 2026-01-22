# ClickWars: Territory - Qt/qmake Project File
# Qt 6.8.3

QT += quick
QT += qml
QT += network
QT += quickcontrols2

CONFIG += c++17
CONFIG += qmltypes

# Nom du projet
TARGET = clickwars-territory
TEMPLATE = app

# Sources C++
SOURCES += \
    src/main.cpp

# Ressources (QML, images, etc.)
RESOURCES += qml.qrc

# Fichiers QML pour l'éditeur (ne sont pas compilés, juste pour la navigation IDE)
DISTFILES += \
    qml/Main.qml \
    qml/screens/MainMenuScreen.qml \
    qml/components/AnimatedButton.qml \
    qml/components/GameStateManager.qml \
    qml/styles/Theme.qml \
    qml/js/GameState.js

# Configuration pour les types QML (requis pour Qt 6)
QML_IMPORT_NAME = ClickWars
QML_IMPORT_MAJOR_VERSION = 1

# macOS Bundle
macx {
    QMAKE_INFO_PLIST = macos/Info.plist
    ICON = assets/icon.icns
}

# Windows
win32 {
    RC_ICONS = assets/icon.ico
}

# Répertoires de sortie
DESTDIR = $$OUT_PWD
OBJECTS_DIR = $$OUT_PWD/obj
MOC_DIR = $$OUT_PWD/moc
RCC_DIR = $$OUT_PWD/rcc

# Messages
message("Building ClickWars: Territory")
message("Qt version: $$QT_VERSION")
