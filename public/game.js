const socket = io();
let team = 'boys', mySwipes = 0, playing = false, serverUrl = '';

// Инициализация
async function init() {
  try {
    const res = await fetch('/api/ip');
    const data = await res.json();
    serverUrl = `http://${data.ip}:${data.port}`;
    document.getElementById('game-url').textContent = `Адрес: ${serverUrl}`;
    
    // Генерация QR (простая, через CDN)
    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('qr-wifi'), {
        text: 'WIFI:T:WPA;S:SwipeRace;P:game1234;;',
        width: 160, height: 160, margin: 2
      });
      new QRCode(document.getElementById('qr-game'), {
        text: serverUrl,
        width: 160, height: 160, margin: 2
      });
    }
  } catch(e) {
    console.warn('IP не определён, используй ручной ввод');
  }
}
init();

// Навигация
window.nextStep = (n) => {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step'+n).classList.add('active');
};

window.enterGame = () => nextStep(3);

// Выбор команды
window.setTeam = (t) => {
  team = t;
  document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('sel'));
  document.querySelector(`.team-btn.${t}`).classList.add('sel');
};

// Вход в игру
window.joinGame = () => {
  const name = document.getElementById('pname').value.trim() || 'Игрок';
  socket.emit('join', { name, team });
  document.getElementById('lobby').classList.add('hide');
  document.getElementById('waiting').classList.remove('hide');
};

// Сокеты
socket.on('playersCount', ({boys, girls}) => {
  document.getElementById('cnt-b').textContent = boys;
  document.getElementById('cnt-g').textContent = girls;
});

socket.on('start', () => {
  playing = true;
  document.getElementById('waiting').classList.add('hide');
  document.getElementById('swipe').classList.remove('hide');
});

socket.on('score', ({team: t, count}) => {
  const progress = Math.min(count / 50, 1);
  const el = document.getElementById(t === 'boys' ? 'ball-b' : 'ball-g');
  el.style.left = `${5 + progress * 80}%`;
});

socket.on('gameOver', ({winner}) => {
  playing = false;
  document.getElementById('swipe').innerHTML = 
    `<h2 style="font-size:1.3rem">🏆 ${winner==='boys'?'👦 Мальчики':'👧 Девочки'} победили!</h2>`;
});

socket.on('reset', () => location.reload());
socket.on('error', msg => alert(msg));

// Свайпы (iOS + Android safe)
let startY = 0;
const zone = document.getElementById('swipe');
if (zone) {
  zone.addEventListener('touchstart', e => { startY = e.touches[0].clientY; e.preventDefault(); }, {passive:false});
  zone.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
  zone.addEventListener('touchend', e => {
    if (playing && startY - e.changedTouches[0].clientY > 30) {
      doSwipe();
    }
    e.preventDefault();
  });
  // Мышь для тестов на ПК
  zone.addEventListener('mousedown', e => startY = e.clientY);
  zone.addEventListener('mouseup', e => {
    if (playing && startY - e.clientY > 30) doSwipe();
  });
}

function doSwipe() {
  mySwipes++;
  document.getElementById('my-count').textContent = mySwipes;
  // Эффект
  const b = document.createElement('div');
  b.className = 'burst';
  b.textContent = team === 'boys' ? '💧' : '🌸';
  zone.appendChild(b);
  setTimeout(() => b.remove(), 400);
  // Отправка
  socket.emit('swipe', { team });
}