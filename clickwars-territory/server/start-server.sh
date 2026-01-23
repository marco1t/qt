#!/bin/bash
# Script pour lancer le serveur WebSocket ClickWars Territory

echo "🚀 Démarrage du serveur WebSocket..."
echo ""

cd "$(dirname "$0")"

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

# Lancer le serveur
echo "✨ Serveur prêt ! Vous pouvez maintenant lancer le jeu."
echo ""
node websocket-server.js
