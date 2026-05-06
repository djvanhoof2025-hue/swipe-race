const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// 🔍 Автоопределение IP (приоритет: хотспоты)
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.match(/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/)) {
          return net.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

const SERVER_IP = process.env.FORCE_IP || getLocalIp();
const PORT = process.env.PORT || 3000;

app.get('/api/ip', (req, res) => res.json({ ip: SERVER_IP, port: PORT }));

let gameState = 'lobby';
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET = 50;
const cooldown = new Map();

io.on('connection', (socket) => {
  socket.on('join', ({ name, team }) => {
    if (gameState !== 'lobby') return socket.emit('error', '🔒 Игра уже началась');
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name: name || 'Игрок', team });
    broadcast();
    socket.emit('joined', { success: true });
  });

  socket.on('swipe', ({ team }) => {
    if (gameState !== 'playing') return;
    const p = players.find(x => x.id === socket.id);
    if (!p || p.team !== team) return;
    const last = cooldown.get(socket.id) || 0;
    if (Date.now() - last < 300) return;
    cooldown.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team] });

    if (scores[team] >= TARGET) {
      gameState = 'finished';
      io.emit('gameOver', { winner: team });
    }
  });

  socket.on('admin', ({ action, password, demoTeam }) => {
    if (password !== '3793') return socket.emit('adminError', '❌ Неверный пароль');
    if (action === 'start') {
      if (players.length < 2) return socket.emit('adminError', '⚠️ Нужно минимум 2 игрока');
      gameState = 'playing';
      io.emit('start');
      socket.emit('adminOk', '🚀 Игра началась!');
    } else if (action === 'reset') {
      gameState = 'lobby';
      scores = { boys: 0, girls: 0 };
      cooldown.clear();
      io.emit('reset');
      socket.emit('adminOk', '🔄 Сброшено');
    } else if (action === 'demo') {
      const t = demoTeam || (Math.random() > 0.5 ? 'boys' : 'girls');
      scores[t]++;
      io.emit('score', { team: t, count: scores[t], demo: true });
      if (scores[t] >= TARGET) {
        gameState = 'finished';
        io.emit('gameOver', { winner: t });
      }
      socket.emit('adminOk', `🎭 Демо: +1 ${t}`);
    }
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    broadcast();
  });
});

function broadcast() {
  io.emit('playersCount', { 
    boys: players.filter(p => p.team === 'boys').length,
    girls: players.filter(p => p.team === 'girls').length,
    list: players.map(p => ({ name: p.name, team: p.team }))
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Сервер: http://${SERVER_IP}:${PORT}`);
  console.log(`🔐 Админка: /admin.html (пароль: 3793)`);
});