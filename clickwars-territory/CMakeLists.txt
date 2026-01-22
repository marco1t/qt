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
    src/main.cpp
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
    QML_FILES
        qml/Main.qml
        qml/screens/MainMenuScreen.qml
        qml/components/AnimatedButton.qml
        qml/components/GameStateManager.qml
        qml/styles/Theme.qml
    SOURCES
        qml/js/GameState.js
    RESOURCES
        # Ajouter ici les assets (images, sons, etc.)
)

# =============================================
# Configuration de la cible
# =============================================

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::Network
    Qt6::QuickControls2
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
