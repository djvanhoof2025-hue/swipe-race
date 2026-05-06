const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// 🔍 Получаем локальный IP для хотспота
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Приоритет для хотспотов: 192.168.43.x (Android), 172.20.10.x (iOS)
        if (iface.address.startsWith('192.168.43.') || 
            iface.address.startsWith('172.20.10.') ||
            iface.address.startsWith('192.168.0.')) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

const SERVER_IP = getLocalIp();
const PORT = process.env.PORT || 3000;

// 📱 Страница настройки с двумя QR
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wifi-setup.html'));
});

// 🌐 API: получить текущий IP сервера
app.get('/api/ip', (req, res) => {
  res.json({ ip: SERVER_IP, port: PORT, url: `http://${SERVER_IP}:${PORT}` });
});

// === GAME STATE ===
let gameState = 'lobby'; // lobby | playing | finished
let players = [];
let scores = { boys: 0, girls: 0 };
const TARGET_SWIPES = 50;
const swipeCooldown = new Map();

io.on('connection', (socket) => {
  
  // 👤 Игрок подключился
  socket.on('join', ({ name, team }) => {
    if (gameState !== 'lobby') {
      return socket.emit('error', '🔒 Игра уже началась');
    }
    // Удаляем старого игрока с таким socket.id (переподключение)
    players = players.filter(p => p.id !== socket.id);
    players.push({ id: socket.id, name: name || 'Игрок', team });
    broadcastPlayers();
    socket.emit('joined', { team, success: true });
  });

  // ⬆️ Свайп
  socket.on('swipe', ({ team }) => {
    if (gameState !== 'playing') return;
    const player = players.find(p => p.id === socket.id);
    if (!player || player.team !== team) return;

    // Анти-спам: 300мс между свайпами
    const last = swipeCooldown.get(socket.id) || 0;
    if (Date.now() - last < 300) return;
    swipeCooldown.set(socket.id, Date.now());

    scores[team]++;
    io.emit('score', { team, count: scores[team] });

    // 🏆 Проверка победы
    if (scores[team] >= TARGET_SWIPES) {
      gameState = 'finished';
      io.emit('gameOver', { winner: team, finalScores: { ...scores } });
    }
  });

  // 🎛️ Админ-команды (пароль: 3793)
  socket.on('admin', ({ action, password }) => {
    if (password !== '3793') {
      return socket.emit('adminError', '❌ Неверный пароль');
    }
    
    if (action === 'start') {
      if (players.length < 2) {
        return socket.emit('adminError', '⚠️ Нужно минимум 2 игрока');
      }
      gameState = 'playing';
      io.emit('start');
      socket.emit('adminOk', { message: '🚀 Игра началась!' });
      
    } else if (action === 'reset') {
      gameState = 'lobby';
      scores = { boys: 0, girls: 0 };
      swipeCooldown.clear();
      // Не сбрасываем игроков, чтобы не выкидывать их
      io.emit('reset');
      socket.emit('adminOk', { message: '🔄 Игра сброшена' });
      
    } else if (action === 'demo') {
      // Демо-свайп от имени сервера
      const team = action.team || (Math.random() > 0.5 ? 'boys' : 'girls');
      scores[team]++;
      io.emit('score', { team, count: scores[team], demo: true });
      if (scores[team] >= TARGET_SWIPES) {
        gameState = 'finished';
        io.emit('gameOver', { winner: team, finalScores: { ...scores } });
      }
      socket.emit('adminOk', { message: `🎭 Демо: +1 ${team}` });
    }
  });

  // 🔌 Игрок отключился
  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    broadcastPlayers();
  });
});

function broadcastPlayers() {
  const boys = players.filter(p => p.team === 'boys').length;
  const girls = players.filter(p => p.team === 'girls').length;
  io.emit('playersCount', { boys, girls, list: players.map(p => ({ name: p.name, team: p.team })) });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Сервер запущен:`);
  console.log(`   📱 Хотспот IP: ${SERVER_IP}`);
  console.log(`   🌐 URL: http://${SERVER_IP}:${PORT}`);
  console.log(`   ⚙️  Админка: /admin.html (пароль: 3793)`);
  console.log(`   🔗 Настройка: /setup`);
});