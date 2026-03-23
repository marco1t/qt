const WebSocket = require('ws');
const ws = new WebSocket('ws://clickwars.ftp.sh:7777');

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'player_join',
        playerId: 'starter_bot',
        name: 'Starter',
        team: 'A'
    }));

    setTimeout(() => {
        ws.send(JSON.stringify({ type: 'start_game' }));
        console.log('Game started');
        setTimeout(() => process.exit(0), 1000);
    }, 500);
});

ws.on('error', (err) => console.error(err));
