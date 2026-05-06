const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Авто-определение локального IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Приоритет для хотспотов
        if (iface.address.startsWith('192.168.43.') || 
            iface.address.startsWith('10.') ||
            iface.address.startsWith('172.')) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

const IP = process.env.FORCE_IP || getLocalIP();
const PORT = process.env.PORT || 3000;

// API для получения текущего адреса
app.get('/api/ip', (req, res) => {
  res.json({ ip: IP, port: PORT, url: `http://${IP}:${PORT}` });
});

// === ИГРОВОЕ СОСТОЯНИЕ ===
let gameState = 'lobby';
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET = 50;
const cooldown = new Map();

io.on('connection', (socket) => {
  
  // Подключение игрока
  socket.on('join', ({ name, team }) => {
    if (gameState !== 'lobby') {
      return socket.emit('error', 'Игра уже началась');
    }
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name: name || 'Игрок', team });
    broadcastPlayers();
    socket.emit('joined', { success: true });
  });

  // Свайп
  socket.on('swipe', ({ team }) => {
    if (gameState !== 'playing') return;
    const player = players.find(p => p.id === socket.id);
    if (!player || player.team !== team) return;
    
    const last = cooldown.get(socket.id) || 0;
    if (Date.now() - last < 250) return;
    cooldown.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team] });

    if (scores[team] >= TARGET) {
      gameState = 'finished';
      io.emit('gameOver', { winner: team });
    }
  });

  // Админ-команды (пароль: 3793)
  socket.on('admin', ({ action, password, demoTeam }) => {
    if (password !== '3793') {
      return socket.emit('adminError', 'Неверный пароль');
    }
    if (action === 'start') {
      if (players.length < 2) {
        return socket.emit('adminError', 'Нужно минимум 2 игрока');
      }
      gameState = 'playing';
      io.emit('start');
      socket.emit('adminOk', 'Игра началась!');
    } else if (action === 'reset') {
      gameState = 'lobby';
      scores = { boys: 0, girls: 0 };
      cooldown.clear();
      io.emit('reset');
      socket.emit('adminOk', 'Сброшено');
    } else if (action === 'demo') {
      const t = demoTeam || (Math.random() > 0.5 ? 'boys' : 'girls');
      scores[t]++;
      io.emit('score', { team: t, count: scores[t], demo: true });
      if (scores[t] >= TARGET) {
        gameState = 'finished';
        io.emit('gameOver', { winner: t });
      }
      socket.emit('adminOk', `Демо: +1 ${t}`);
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    broadcastPlayers();
  });
});

function broadcastPlayers() {
  io.emit('playersCount', {
    boys: players.filter(p => p.team === 'boys').length,
    girls: players.filter(p => p.team === 'girls').length
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Сервер: http://${IP}:${PORT}`);
  console.log(`🔐 Админка: /admin.html (пароль: 3793)`);
});