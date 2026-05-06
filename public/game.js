const io = io();
let team = 'boys', swipes = 0, run = false;

// QR
async function boot() {
  try {
    const r = await fetch('/api/ip');
    const { ip, port } = await r.json();
    document.getElementById('url-g').textContent = `http://${ip}:${port}`;
    new QRCode('qr-w', { text:'WIFI:T:WPA;S:SwipeRace;P:game1234;;', width:150, height:150, margin:2 });
    new QRCode('qr-g', { text:`http://${ip}:${port}`, width:150, height:150, margin:2 });
  } catch(e) {
    document.getElementById('qr-w').innerHTML = '<p style="color:#f87171">QR не загрузился. Обновите страницу.</p>';
  }
}
boot();

// UI
window.to = id => {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};
window.pick = t => {
  team = t;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('sel'));
  document.querySelector(`.tb.${t==='boys'?'b':'g'}`).classList.add('sel');
};
window.join = () => {
  const n = document.getElementById('nm').value.trim() || 'Игрок';
  io.emit('join', { name: n, team });
  document.getElementById('ui-wait').classList.add('hide');
  document.getElementById('ui-ready').classList.remove('hide');
};

// Sockets
io.on('playersCount', ({boys, girls}) => {
  document.getElementById('cb').textContent = boys;
  document.getElementById('cg').textContent = girls;
});
io.on('start', () => {
  run = true;
  document.getElementById('ui-ready').classList.add('hide');
  document.getElementById('ui-play').classList.remove('hide');
});
io.on('score', ({team: t, count}) => {
  const p = Math.min(count/50, 1);
  document.getElementById(t==='boys'?'blb':'blg').style.left = `${5 + p*80}%`;
});
io.on('gameOver', ({winner}) => {
  run = false;
  document.getElementById('ui-play').innerHTML = `<h2 style="font-size:1.5rem">🏆 ${winner==='boys'?'👦 Мальчики':'👧 Девочки'} победили!</h2>`;
});
io.on('reset', () => location.reload());

// Swipe
let sy = 0;
const z = document.getElementById('ui-play');
z.addEventListener('touchstart', e => { sy = e.touches[0].clientY; e.preventDefault(); }, {passive:false});
z.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
z.addEventListener('touchend', e => {
  if(run && sy - e.changedTouches[0].clientY > 35) {
    swipes++; document.getElementById('mc').textContent = swipes;
    const b = document.createElement('div'); b.className='burst'; b.textContent=team==='boys'?'💧':'🌸';
    z.appendChild(b); setTimeout(()=>b.remove(), 500);
    io.emit('swipe', {team});
  }
  e.preventDefault();
});
z.addEventListener('mousedown', e => sy = e.clientY);
z.addEventListener('mouseup', e => { if(run && sy - e.clientY > 35) { swipes++; document.getElementById('mc').textContent=swipes; io.emit('swipe', {team}); }});