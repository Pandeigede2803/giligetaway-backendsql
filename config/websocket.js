// config/websocket.js
const { WebSocketServer } = require('ws');

let wss; // Variabel untuk menyimpan WebSocket server

function initWebSocketServer(server) {
  // Inisialisasi WebSocket server
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  console.log('WebSocket server initialized');
}

// Fungsi broadcast untuk mengirim data ke semua klien WebSocket`
function broadcast(data) {
  if (!wss) {
    console.error('WebSocket server belum diinisialisasi.');
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      console.log('Mengirim data ke frontend:', data);
      client.send(JSON.stringify(data));
    }
  });
}

module.exports = { initWebSocketServer, broadcast };