#ifndef NETWORKUTILS_H
#define NETWORKUTILS_H

#include <QObject>
#include <QString>

class NetworkUtils : public QObject
{
    Q_OBJECT
public:
    explicit NetworkUtils(QObject *parent = nullptr);

    Q_INVOKABLE QString getLocalIpAddress();
};

#endif // NETWORKUTILS_H
