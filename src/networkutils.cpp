#include "networkutils.h"
#include <QNetworkInterface>
#include <QAbstractSocket>

NetworkUtils::NetworkUtils(QObject *parent) : QObject(parent)
{
}

QString NetworkUtils::getLocalIpAddress()
{
    const QList<QHostAddress> allAddresses = QNetworkInterface::allAddresses();

    // First pass: Try to find a non-localhost IPv4 address
    for (const QHostAddress &address : allAddresses) {
        if (address.protocol() == QAbstractSocket::IPv4Protocol && address != QHostAddress::LocalHost) {
            return address.toString();
        }
    }

    // Fallback
    return "127.0.0.1";
}
