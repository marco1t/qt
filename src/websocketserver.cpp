#include "websocketserver.h"
#include <QDebug>
#include <QDateTime>

WebSocketServerWrapper::WebSocketServerWrapper(QObject *parent)
    : QObject(parent)
    , m_server(nullptr)
    , m_port(7777)
{
}

WebSocketServerWrapper::~WebSocketServerWrapper()
{
    stopServer();
}

bool WebSocketServerWrapper::isListening() const
{
    return m_server && m_server->isListening();
}

int WebSocketServerWrapper::port() const
{
    return m_port;
}

void WebSocketServerWrapper::setPort(int port)
{
    if (m_port != port) {
        m_port = port;
        emit portChanged();
    }
}

int WebSocketServerWrapper::clientCount() const
{
    return m_clients.size();
}

bool WebSocketServerWrapper::startServer()
{
    if (m_server && m_server->isListening()) {
        qWarning() << "WebSocketServer: Server already running";
        return false;
    }
    
    // Créer le serveur
    if (!m_server) {
        m_server = new QWebSocketServer(
            QStringLiteral("ClickWars Server"),
            QWebSocketServer::NonSecureMode,
            this
        );
        
        connect(m_server, &QWebSocketServer::newConnection,
                this, &WebSocketServerWrapper::onNewConnection);
    }
    
    // Démarrer l'écoute
    if (m_server->listen(QHostAddress::Any, m_port)) {
        qInfo() << "WebSocketServer: Listening on port" << m_port;
        emit isListeningChanged();
        return true;
    } else {
        QString error = m_server->errorString();
        qWarning() << "WebSocketServer: Failed to start:" << error;
        emit errorOccurred(error);
        return false;
    }
}

void WebSocketServerWrapper::stopServer()
{
    if (!m_server) {
        return;
    }
    
    // Déconnecter tous les clients
    for (auto *client : m_clients.values()) {
        client->close();
        client->deleteLater();
    }
    m_clients.clear();
    emit clientCountChanged();
    
    // Arrêter le serveur
    if (m_server->isListening()) {
        m_server->close();
        qInfo() << "WebSocketServer: Server stopped";
        emit isListeningChanged();
    }
}

void WebSocketServerWrapper::sendToAll(const QString &message)
{
    if (!m_server || !m_server->isListening()) {
        qWarning() << "WebSocketServer: Cannot send, server not running";
        return;
    }
    
    for (auto *client : m_clients.values()) {
        if (client->state() == QAbstractSocket::ConnectedState) {
            client->sendTextMessage(message);
        }
    }
}

void WebSocketServerWrapper::sendToClient(const QString &clientId, const QString &message)
{
    if (!m_clients.contains(clientId)) {
        qWarning() << "WebSocketServer: Client not found:" << clientId;
        return;
    }
    
    QWebSocket *client = m_clients[clientId];
    if (client && client->state() == QAbstractSocket::ConnectedState) {
        client->sendTextMessage(message);
    }
}

QStringList WebSocketServerWrapper::getConnectedClients() const
{
    return m_clients.keys();
}

void WebSocketServerWrapper::onNewConnection()
{
    QWebSocket *socket = m_server->nextPendingConnection();
    
    if (!socket) {
        return;
    }
    
    QString clientId = generateClientId(socket);
    m_clients[clientId] = socket;
    
    qInfo() << "WebSocketServer: Client connected:" << clientId;
    emit clientConnected(clientId);
    emit clientCountChanged();
    
    // Connecter les signaux du client
    connect(socket, &QWebSocket::textMessageReceived,
            this, &WebSocketServerWrapper::onTextMessageReceived);
    connect(socket, &QWebSocket::disconnected,
            this, &WebSocketServerWrapper::onClientDisconnected);
}

void WebSocketServerWrapper::onTextMessageReceived(const QString &message)
{
    QWebSocket *client = qobject_cast<QWebSocket*>(sender());
    if (!client) {
        return;
    }
    
    // Trouver l'ID du client
    QString clientId;
    for (auto it = m_clients.constBegin(); it != m_clients.constEnd(); ++it) {
        if (it.value() == client) {
            clientId = it.key();
            break;
        }
    }
    
    if (!clientId.isEmpty()) {
        emit messageReceived(clientId, message);
    }
}

void WebSocketServerWrapper::onClientDisconnected()
{
    QWebSocket *client = qobject_cast<QWebSocket*>(sender());
    if (!client) {
        return;
    }
    
    // Trouver et retirer le client
    QString clientId;
    for (auto it = m_clients.begin(); it != m_clients.end(); ++it) {
        if (it.value() == client) {
            clientId = it.key();
            m_clients.erase(it);
            break;
        }
    }
    
    if (!clientId.isEmpty()) {
        qInfo() << "WebSocketServer: Client disconnected:" << clientId;
        emit clientDisconnected(clientId);
        emit clientCountChanged();
    }
    
    client->deleteLater();
}

QString WebSocketServerWrapper::generateClientId(QWebSocket *socket)
{
    QString ip = socket->peerAddress().toString();
    quint16 port = socket->peerPort();
    qint64 timestamp = QDateTime::currentMSecsSinceEpoch();
    
    return QString("client_%1_%2_%3").arg(ip).arg(port).arg(timestamp);
}
