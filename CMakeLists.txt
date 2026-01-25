cmake_minimum_required(VERSION 3.16)

project(clickwars-territory VERSION 1.0.0 LANGUAGES CXX)

# =============================================
# Configuration Qt
# =============================================

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Trouver Qt6
find_package(Qt6 REQUIRED COMPONENTS
    Core
    Quick
    Qml
    Network
    QuickControls2
    WebSockets
)

# =============================================
# Felgo SDK (optionnel)
# =============================================

# Si FELGO_SDK_PATH est défini, inclure Felgo
if(DEFINED ENV{FELGO_SDK_PATH})
    message(STATUS "Felgo SDK found at: $ENV{FELGO_SDK_PATH}")
    # include($ENV{FELGO_SDK_PATH}/felgo.cmake)
else()
    message(STATUS "Building without Felgo (Qt-only mode)")
endif()

# =============================================
# Sources
# =============================================

set(PROJECT_SOURCES
    src/Main.cpp
    src/websocketserver.h
    src/websocketserver.cpp
)

# =============================================
# Ressources QML
# =============================================

qt_add_executable(${PROJECT_NAME}
    ${PROJECT_SOURCES}
)

# Ajouter le module QML
qt_add_qml_module(${PROJECT_NAME}
    URI ClickWars
    VERSION 1.0
    RESOURCE_PREFIX "/"
    QML_FILES
        qml/Main.qml
        qml/screens/MainMenuScreen.qml
        qml/screens/GameScreen.qml
        qml/screens/LobbyScreen.qml
        qml/screens/ServerBrowserScreen.qml
        qml/screens/NetworkTest.qml
        qml/components/AnimatedButton.qml
        qml/components/GameStateManager.qml
        qml/components/NetworkManager.qml
        qml/components/ToastNotification.qml
        qml/components/ClickZone.qml
        qml/components/BotController.qml
        qml/components/GaugeBar.qml
        qml/styles/Theme.qml
        qml/js/GameState.js
        qml/js/BotManager.js
    RESOURCES
        qml/styles/qmldir
        qml/components/qmldir
        qml/screens/qmldir
)

set_source_files_properties(qml/styles/Theme.qml PROPERTIES QT_QML_SINGLETON_TYPE TRUE)

# =============================================
# Configuration de la cible
# =============================================

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::Network
    Qt6::QuickControls2
    Qt6::WebSockets
)

# =============================================
# Propriétés de l'exécutable
# =============================================

set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_GUI_IDENTIFIER com.clickwars.territory
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    WIN32_EXECUTABLE TRUE
)

# =============================================
# Installation
# =============================================

install(TARGETS ${PROJECT_NAME}
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
)

# =============================================
# Messages de configuration
# =============================================

message(STATUS "")
message(STATUS "=== ClickWars: Territory ===")
message(STATUS "Version: ${PROJECT_VERSION}")
message(STATUS "Qt Version: ${Qt6_VERSION}")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "")
