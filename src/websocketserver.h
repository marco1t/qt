#ifndef WEBSOCKETSERVER_H
#define WEBSOCKETSERVER_H

#include <QObject>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QMap>
#include <QString>
#include <QHostAddress>

/**
 * WebSocketServerWrapper - Serveur WebSocket exposé à QML
 * 
 * Wrapper autour de QWebSocketServer pour l'utiliser en QML.
 * Gère les connexions clients et l'envoi/réception de messages.
 */
class WebSocketServerWrapper : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool isListening READ isListening NOTIFY isListeningChanged)
    Q_PROPERTY(int port READ port WRITE setPort NOTIFY portChanged)
    Q_PROPERTY(int clientCount READ clientCount NOTIFY clientCountChanged)
    
public:
    explicit WebSocketServerWrapper(QObject *parent = nullptr);
    ~WebSocketServerWrapper();
    
    // Propriétés
    bool isListening() const;
    int port() const;
    void setPort(int port);
    int clientCount() const;
    
    // Méthodes invocables depuis QML
    Q_INVOKABLE bool startServer();
    Q_INVOKABLE void stopServer();
    Q_INVOKABLE void sendToAll(const QString &message);
    Q_INVOKABLE void sendToClient(const QString &clientId, const QString &message);
    Q_INVOKABLE QStringList getConnectedClients() const;
    
signals:
    void isListeningChanged();
    void portChanged();
    void clientCountChanged();
    
    void clientConnected(const QString &clientId);
    void clientDisconnected(const QString &clientId);
    void messageReceived(const QString &clientId, const QString &message);
    void errorOccurred(const QString &error);
    
private slots:
    void onNewConnection();
    void onTextMessageReceived(const QString &message);
    void onClientDisconnected();
    
private:
    QWebSocketServer *m_server;
    QMap<QString, QWebSocket*> m_clients;
    int m_port;
    
    QString generateClientId(QWebSocket *socket);
};

#endif // WEBSOCKETSERVER_H
