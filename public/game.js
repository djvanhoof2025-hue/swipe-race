const socket = io();
let currentTeam = 'boys';
let mySwipes = 0;
let gameStarted = false;
let serverIp = '127.0.0.1';
let serverPort = '3000';

// Шаги
function goStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Инициализация QR
async function initQR() {
  try {
    const res = await fetch('/api/ip');
    const data = await res.json();
    serverIp = data.ip; serverPort = data.port;
    document.getElementById('server-url').textContent = `http://${serverIp}:${serverPort}`;
    
    // WiFi QR
    const wifiStr = `WIFI:T:WPA;S:SwipeRace;P:game1234;;`;
    QRCode.toCanvas(document.createElement('canvas'), wifiStr, { width: 180 }, (err, canvas) => {
      if(!err) document.getElementById('wifi-qr').appendChild(canvas);
    });
    
    // Game QR
    const gameUrl = `http://${serverIp}:${serverPort}`;
    QRCode.toCanvas(document.createElement('canvas'), gameUrl, { width: 180 }, (err, canvas) => {
      if(!err) document.getElementById('game-qr').appendChild(canvas);
    });
  } catch(e) {
    console.warn('Авто-IP не найден, используй ручной ввод');
  }
}
initQR();

function applyManualIp() {
  const ip = document.getElementById('manual-ip').value.trim();
  if(!ip) return;
  serverIp = ip;
  document.getElementById('server-url').textContent = `http://${serverIp}:${serverPort}`;
  document.getElementById('game-qr').innerHTML = '';
  QRCode.toCanvas(document.createElement('canvas'), `http://${serverIp}:${serverPort}`, { width: 180 }, (err, canvas) => {
    if(!err) document.getElementById('game-qr').appendChild(canvas);
  });
}

function selectTeam(t) {
  currentTeam = t;
  document.querySelectorAll('.team-opt').forEach(o => o.classList.remove('selected'));
  document.querySelector(`.team-opt.${t}`).classList.add('selected');
}

function joinLobby() {
  const name = document.getElementById('player-name').value.trim() || 'Игрок';
  socket.emit('join', { name, team: currentTeam });
  document.getElementById('lobby-ui').style.display = 'none';
  document.getElementById('waiting-ui').style.display = 'block';
}

function startGameClient() {
  goStep('step-play');
}

// Сокеты
socket.on('playersCount', ({ boys, girls, list }) => {
  document.getElementById('count-boys').textContent = boys;
  document.getElementById('count-girls').textContent = girls;
  if(document.getElementById('waiting-ui').style.display === 'block') {
    document.getElementById('ready-text').textContent = `Подключилось: ${boys + playersCount()}`;
  }
});

socket.on('start', () => {
  gameStarted = true;
  document.getElementById('waiting-ui').style.display = 'none';
  document.getElementById('swipe-zone').style.display = 'flex';
  document.getElementById('swipe-zone').className = `swipe-zone ${currentTeam}`;
});

socket.on('score', ({ team, count }) => {
  const progress = Math.min(count / 50, 1);
  const left = 5 + (progress * 80) + '%';
  document.getElementById(team === 'boys' ? 'ball-boys' : 'ball-girls').style.left = left;
});

socket.on('gameOver', ({ winner }) => {
  gameStarted = false;
  document.getElementById('swipe-zone').innerHTML = `<div class="winner-text">🏆 ${winner === 'boys' ? '👦 Мальчики' : '👧 Девочки'} победили!</div>`;
});

socket.on('reset', () => location.reload());
socket.on('error', msg => alert(msg));
socket.on('adminOk', msg => console.log(msg));

// Свайпы (iOS Safe)
let startY = 0;
const zone = document.getElementById('swipe-zone');

if(zone) {
  zone.addEventListener('touchstart', e => { startY = e.touches[0].clientY; e.preventDefault(); }, { passive: false });
  zone.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  zone.addEventListener('touchend', e => {
    if (startY - e.changedTouches[0].clientY > 50 && gameStarted) {
      mySwipes++;
      document.getElementById('my-swipes').textContent = mySwipes;
      createBurst();
      socket.emit('swipe', { team: currentTeam });
    }
    e.preventDefault();
  });
  // Mouse fallback
  zone.addEventListener('mousedown', e => startY = e.clientY);
  zone.addEventListener('mouseup', e => {
    if (startY - e.clientY > 50 && gameStarted) {
      mySwipes++; document.getElementById('my-swipes').textContent = mySwipes; createBurst();
      socket.emit('swipe', { team: currentTeam });
    }
  });
}

function createBurst() {
  const b = document.createElement('div');
  b.className = 'burst';
  b.textContent = currentTeam === 'boys' ? '💧' : '🌸';
  zone.appendChild(b);
  setTimeout(() => b.remove(), 600);
}