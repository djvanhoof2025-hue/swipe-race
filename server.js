const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const qr = require('qr-image');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/qr.png', (req, res) => {
  const ip = req.socket.localAddress === '::1' ? '127.0.0.1' : req.socket.localAddress;
  const url = `http://${ip}:${process.env.PORT || 3000}`;
  const qr_svg = qr.image(url, { type: 'png', margin: 2, size: 10 });
  res.type('png');
  qr_svg.pipe(res);
});

let gameState = 'lobby';
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET_SWIPES = 50;
const swipeCooldown = new Map();

io.on('connection', (socket) => {
  socket.on('join', ({ name, team }) => {
    if (gameState !== 'lobby') return socket.emit('error', 'Игра уже началась');
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name, team });
    broadcastPlayers();
  });

  socket.on('swipe', ({ team }) => {
    if (gameState !== 'playing') return;
    const player = players.find(p => p.id === socket.id);
    if (!player || player.team !== team) return;

    const last = swipeCooldown.get(socket.id) || 0;
    if (Date.now() - last < 300) return;
    swipeCooldown.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team], total: scores.boys + scores.girls });

    if (scores[team] >= TARGET_SWIPES) {
      gameState = 'finished';
      io.emit('gameOver', { winner: team });
    }
  });

  socket.on('admin', ({ action, password }) => {
    if (password !== '1111') return socket.emit('adminError', 'Неверный пароль');
    if (action === 'start') {
      if (players.length < 2) return socket.emit('adminError', 'Нужно минимум 2 игрока');
      gameState = 'playing';
      io.emit('start');
    } else if (action === 'reset') {
      gameState = 'lobby';
      scores = { boys: 0, girls: 0 };
      players = [];
      swipeCooldown.clear();
      io.emit('reset');
    }
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    broadcastPlayers();
  });
});

function broadcastPlayers() {
  const boys = players.filter(p => p.team === 'boys').length;
  const girls = players.filter(p => p.team === 'girls').length;
  io.emit('playersCount', { boys, girls });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Сервер запущен: http://0.0.0.0:${PORT}`);
});