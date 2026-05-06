const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('os');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// 🔍 Авто-определение IP (локальная сеть)
function getIp() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets)) {
    for (const iface of nets[n]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.match(/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/)) return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const IP = process.env.FORCE_IP || getIp();
const PORT = process.env.PORT || 3000;
app.get('/api/ip', (req, res) => res.json({ ip: IP, port: PORT }));

let state = 'lobby'; // lobby | playing | finished
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET = 50;
const cd = new Map();

io.on('connection', socket => {
  socket.on('join', ({ name, team }) => {
    if (state !== 'lobby') return socket.emit('err', '🔒 Игра уже началась');
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name: name || 'Игрок', team });
    io.emit('playersCount', { 
      boys: players.filter(p => p.team === 'boys').length,
      girls: players.filter(p => p.team === 'girls').length 
    });
  });

  socket.on('swipe', ({ team }) => {
    if (state !== 'playing') return;
    const p = players.find(x => x.id === socket.id);
    if (!p || p.team !== team) return;
    const last = cd.get(socket.id) || 0;
    if (Date.now() - last < 250) return;
    cd.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team] });
    if (scores[team] >= TARGET) {
      state = 'finished';
      io.emit('gameOver', { winner: team });
    }
  });

  socket.on('admin', ({ action, password, demoTeam }) => {
    if (password !== '3793') return socket.emit('adminErr', '❌ Пароль неверный');
    if (action === 'start') {
      if (players.length < 2) return socket.emit('adminErr', '⚠️ Нужно ≥2 игроков');
      state = 'playing'; io.emit('start'); socket.emit('ok', '🚀 Старт!');
    } else if (action === 'reset') {
      state = 'lobby'; scores = { boys: 0, girls: 0 }; cd.clear(); io.emit('reset');
    } else if (action === 'demo') {
      const t = demoTeam || (Math.random() > 0.5 ? 'boys' : 'girls');
      scores[t]++; io.emit('score', { team: t, count: scores[t], demo: true });
      if (scores[t] >= TARGET) { state = 'finished'; io.emit('gameOver', { winner: t }); }
    }
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit('playersCount', { 
      boys: players.filter(p => p.team === 'boys').length,
      girls: players.filter(p => p.team === 'girls').length 
    });
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🟢 http://${IP}:${PORT}`));