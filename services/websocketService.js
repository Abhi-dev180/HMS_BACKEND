const { WebSocketServer } = require('ws');

let wss;

const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
  });
  
  console.log('[WebSocket] Server initialized');
};

const broadcast = (type, data = {}) => {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized yet');
    return;
  }
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  });
};

module.exports = {
  initWebSocket,
  broadcast
};
