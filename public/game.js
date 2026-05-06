const socket = io({ reconnection: true });
let currentTeam = 'boys';
let mySwipes = 0;
let gameStarted = false;

// Инициализация частиц
function initParticles() {
  const bg = document.querySelector('.bg-layer');
  for(let i=0; i<30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (8 + Math.random() * 8) + 's';
    p.style.animationDelay = Math.random() * 5 + 's';
    bg.appendChild(p);
  }
}
initParticles();

// UI Elements
const screens = document.querySelectorAll('.screen');
const swipeZone = document.getElementById('swipeZone');
const ballBoys = document.getElementById('ballBoys');
const ballGirls = document.getElementById('ballGirls');
const waitingMsg = document.getElementById('waitingMsg');

function showScreen(id) {
  screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
}

// Выбор команды
document.querySelectorAll('.team-option').forEach(opt => {
  opt.onclick = () => {
    document.querySelectorAll('.team-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    currentTeam = opt.dataset.team;
  };
});

// Вход
document.getElementById('joinBtn').onclick = () => {
  const name = document.getElementById('playerName').value.trim() || 'Игрок';
  socket.emit('join', { name, team: currentTeam });
  showScreen('gameScreen');
};

// Обновление UI игроков
socket.on('playersCount', ({ boys, girls }) => {
  const bEl = document.getElementById('countBoys');
  const gEl = document.getElementById('countGirls');
  if(bEl) bEl.textContent = boys;
  if(gEl) gEl.textContent = girls;
  const admB = document.getElementById('admBoys');
  const admG = document.getElementById('admGirls');
  if(admB) admB.textContent = boys;
  if(admG) admG.textContent = girls;
});

// События игры
socket.on('start', () => {
  gameStarted = true;
  if(waitingMsg) waitingMsg.style.display = 'none';
  if(swipeZone) swipeZone.style.borderColor = currentTeam === 'boys' ? 'rgba(79,172,254,0.6)' : 'rgba(255,107,107,0.6)';
});

socket.on('score', ({ team, count }) => {
  const progress = Math.min(count / 50, 1);
  const left = 5 + (progress * 80) + '%';
  
  if(team === 'boys') ballBoys.style.left = left;
  else ballGirls.style.left = left;

  if(document.getElementById('admBoysSwipes')) {
    document.getElementById('admBoysSwipes').textContent = team === 'boys' ? count : document.getElementById('admBoysSwipes').textContent;
    document.getElementById('admGirlsSwipes').textContent = team === 'girls' ? count : document.getElementById('admGirlsSwipes').textContent;
  }
});

socket.on('gameOver', ({ winner }) => {
  const wt = document.getElementById('winnerTeam');
  wt.textContent = winner === 'boys' ? '👦 МАЛЬЧИКИ' : '👧 ДЕВОЧКИ';
  wt.className = `winner-team ${winner}`;
  showScreen('gameOverScreen');
});

socket.on('reset', () => {
  location.reload();
});

socket.on('error', msg => alert(msg));

// SWIPE LOGIC (iOS Safe)
let startY = 0;
if(swipeZone) {
  swipeZone.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });

  swipeZone.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  swipeZone.addEventListener('touchend', e => {
    const endY = e.changedTouches[0].clientY;
    if (startY - endY > 50 && gameStarted) {
      performSwipe();
    }
    e.preventDefault();
  });
  
  // Mouse fallback
  swipeZone.addEventListener('mousedown', e => startY = e.clientY);
  swipeZone.addEventListener('mouseup', e => {
    if(startY - e.clientY > 50 && gameStarted) performSwipe();
  });
}

function performSwipe() {
  mySwipes++;
  const cnt = document.getElementById('swipeCount');
  if(cnt) cnt.textContent = mySwipes;
  
  // Визуальный эффект взрыва
  const burst = document.createElement('div');
  burst.className = 'swipe-burst';
  burst.textContent = currentTeam === 'boys' ? '💧' : '🌸';
  burst.style.left = '50%';
  burst.style.top = '60%';
  swipeZone.appendChild(burst);
  setTimeout(() => burst.remove(), 600);

  socket.emit('swipe', { team: currentTeam });
}

// Admin controls
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');

if(btnStart) {
  btnStart.onclick = () => {
    const pwd = prompt('Пароль ведущего:', '');
    socket.emit('admin', { action: 'start', password: pwd });
  };
}
if(btnReset) {
  btnReset.onclick = () => {
    const pwd = prompt('Пароль ведущего:', '');
    socket.emit('admin', { action: 'reset', password: pwd });
  };
}

socket.on('adminError', msg => alert(msg));