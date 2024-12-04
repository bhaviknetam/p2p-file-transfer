const http = require('http');
const WebSocket = require('ws');
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Connected to WebSocket server');
    ws.on('message', (message) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });
    ws.on('close', () => {
        console.log("Client disconnected");

    })
});

server.listen(8080, () => {
    console.log('WebSocket server is running on port 8080');
});

module.exports = server;
