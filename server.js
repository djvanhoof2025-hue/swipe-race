// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Получение локального IP
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.match(/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/)) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

const IP = process.env.FORCE_IP || getLocalIP();
const PORT = process.env.PORT || 3000;

// API для клиента
app.get('/api/ip', (req, res) => {
  res.json({ ip: IP, port: PORT, url: `http://${IP}:${PORT}` });
});

// === СОСТОЯНИЕ ИГРЫ ===
let state = 'lobby'; // lobby | playing | finished
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET = 50;
const cooldown = new Map();

io.on('connection', (socket) => {
  
  // Игрок подключился
  socket.on('join', ({ name, team }) => {
    if (state !== 'lobby') return socket.emit('error', 'Игра уже началась');
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name: name || 'Игрок', team });
    broadcast();
  });

  // Свайп
  socket.on('swipe', ({ team }) => {
    if (state !== 'playing') return;
    const p = players.find(x => x.id === socket.id);
    if (!p || p.team !== team) return;
    
    const last = cooldown.get(socket.id) || 0;
    if (Date.now() - last < 250) return;
    cooldown.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team] });

    if (scores[team] >= TARGET) {
      state = 'finished';
      io.emit('gameOver', { winner: team });
    }
  });

  // Админ (пароль: 3793)
  socket.on('admin', ({ action, password, demoTeam }) => {
    if (password !== '3793') return socket.emit('adminError', 'Неверный пароль');
    
    if (action === 'start') {
      if (players.length < 2) return socket.emit('adminError', 'Нужно ≥2 игроков');
      state = 'playing';
      io.emit('start');
      socket.emit('adminOk', 'Старт!');
    } 
    else if (action === 'reset') {
      state = 'lobby';
      scores = { boys: 0, girls: 0 };
      cooldown.clear();
      io.emit('reset');
      socket.emit('adminOk', 'Сброшено');
    }
    else if (action === 'demo') {
      const t = demoTeam || (Math.random() > 0.5 ? 'boys' : 'girls');
      scores[t]++;
      io.emit('score', { team: t, count: scores[t], demo: true });
      if (scores[t] >= TARGET) {
        state = 'finished';
        io.emit('gameOver', { winner: t });
      }
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    broadcast();
  });
});

function broadcast() {
  io.emit('playersCount', {
    boys: players.filter(p => p.team === 'boys').length,
    girls: players.filter(p => p.team === 'girls').length
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер: http://${IP}:${PORT}`);
  console.log(`✅ Админка: /admin.html`);
  console.log(`✅ Пароль: 3793`);
});