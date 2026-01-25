/**
 * ClickWars: Territory - Main Entry Point
 *
 * Point d'entrée C++ pour l'application Qt 6.
 * Charge le fichier QML principal depuis les ressources.
 */

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QUrl>
#include "websocketserver.h"

int main(int argc, char *argv[])
{
    // Configuration de l'application
    QGuiApplication app(argc, argv);

    // Métadonnées
    app.setApplicationName("ClickWars: Territory");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("ClickWars");
    app.setOrganizationDomain("clickwars.local");

    // Style Qt Quick Controls (Basic, Fusion, Material, Universal)
    QQuickStyle::setStyle("Basic");

    // Enregistrer le type C++ pour QML
    qmlRegisterType<WebSocketServerWrapper>("ClickWars.Network", 1, 0, "WebSocketServer");

    // Moteur QML
    QQmlApplicationEngine engine;

    // Ajouter le chemin d'import pour les modules QML locaux
    // engine.addImportPath("qrc:/qml");

    // Connexion pour gérer les erreurs de chargement
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection
    );

    // Charger le QML principal depuis les ressources
    const QUrl url(QStringLiteral("qrc:/ClickWars/qml/Main.qml"));
    engine.load(url);

    // Vérifier que le chargement a réussi
    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    // Lancer la boucle d'événements
    return app.exec();
}
