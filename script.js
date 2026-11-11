(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const pointsTable = document.getElementById('points');

  // 動物5種: 大きいほど低得点、小さいほど高得点
  const ANIMALS = [
    { emoji: '🐘', name: 'ゾウ',   size: 84, points: 1,  weight: 30 },
    { emoji: '🐻', name: 'クマ',   size: 68, points: 2,  weight: 25 },
    { emoji: '🐶', name: 'イヌ',   size: 54, points: 3,  weight: 20 },
    { emoji: '🐰', name: 'ウサギ', size: 40, points: 5,  weight: 15 },
    { emoji: '🐭', name: 'ネズミ', size: 28, points: 10, weight: 10 },
  ];

  pointsTable.innerHTML = ANIMALS.map(a =>
    `<tr><td>${a.emoji}</td><td>${a.name}</td><td>${a.points}点</td></tr>`
  ).join('');

  let best = 0;
  try { best = Number(localStorage.getItem('animalCatchBest')) || 0; } catch (e) {}
  bestEl.textContent = best;

  const basket = { w: 110, h: 38, x: W / 2 - 55, y: H - 80, speed: 480 };
  let animals, popups, score, lives, running, spawnTimer, elapsed, lastTime;
  const keys = { left: false, right: false };
  let pointerX = null;

  function reset() {
    animals = [];
    popups = [];
    score = 0;
    lives = 3;
    spawnTimer = 0;
    elapsed = 0;
    basket.x = W / 2 - basket.w / 2;
    pointerX = null;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    livesEl.textContent = '❤️'.repeat(Math.max(lives, 0)) + '🖤'.repeat(Math.max(3 - lives, 0));
  }

  function pickAnimal() {
    const total = ANIMALS.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of ANIMALS) {
      if ((r -= a.weight) <= 0) return a;
    }
    return ANIMALS[0];
  }

  function spawn() {
    const type = pickAnimal();
    const difficulty = Math.min(elapsed / 60, 1); // 60秒で最大
    animals.push({
      type,
      x: type.size / 2 + Math.random() * (W - type.size),
      y: -type.size,
      vy: 130 + difficulty * 200 + Math.random() * 60,
      rot: (Math.random() - 0.5) * 0.4,
      vr: (Math.random() - 0.5) * 2,
    });
  }

  function update(dt) {
    elapsed += dt;

    // カゴの移動
    if (keys.left) basket.x -= basket.speed * dt;
    if (keys.right) basket.x += basket.speed * dt;
    if (pointerX !== null) {
      const target = pointerX - basket.w / 2;
      basket.x += (target - basket.x) * Math.min(1, dt * 18);
    }
    basket.x = Math.max(0, Math.min(W - basket.w, basket.x));

    // 出現
    const interval = Math.max(0.45, 1.1 - elapsed / 90);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = interval * (0.7 + Math.random() * 0.6);
    }

    // 動物
    for (let i = animals.length - 1; i >= 0; i--) {
      const a = animals[i];
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
      const half = a.type.size / 2;

      const caught =
        a.y + half * 0.6 >= basket.y &&
        a.y <= basket.y + basket.h &&
        a.x >= basket.x - half * 0.3 &&
        a.x <= basket.x + basket.w + half * 0.3;

      if (caught) {
        score += a.type.points;
        popups.push({ x: a.x, y: basket.y - 10, text: `+${a.type.points}`, life: 0.8 });
        animals.splice(i, 1);
        if (score > best) {
          best = score;
          try { localStorage.setItem('animalCatchBest', best); } catch (e) {}
        }
        updateHud();
      } else if (a.y - half > H - 40) {
        animals.splice(i, 1);
        lives--;
        updateHud();
        if (lives <= 0) { gameOver(); return; }
      }
    }

    // ポップアップ
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt;
      popups[i].y -= 50 * dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 地面
    ctx.fillStyle = '#b6e388';
    ctx.fillRect(0, H - 40, W, 40);

    // 動物
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of animals) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.font = `${a.type.size}px serif`;
      ctx.fillText(a.type.emoji, 0, 0);
      ctx.restore();
    }

    // カゴ
    ctx.fillStyle = '#a0632b';
    ctx.beginPath();
    ctx.moveTo(basket.x, basket.y);
    ctx.lineTo(basket.x + basket.w, basket.y);
    ctx.lineTo(basket.x + basket.w - 14, basket.y + basket.h);
    ctx.lineTo(basket.x + 14, basket.y + basket.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e3f14';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const x = basket.x + (basket.w / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, basket.y + 2);
      ctx.lineTo(x * 0.98 + basket.w * 0.01, basket.y + basket.h - 2);
      ctx.stroke();
    }

    // 得点表示
    ctx.font = 'bold 24px sans-serif';
    for (const p of popups) {
      ctx.globalAlpha = Math.max(p.life / 0.8, 0);
      ctx.fillStyle = '#ff6b00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    update(dt);
    if (running) { draw(); requestAnimationFrame(loop); }
  }

  function start() {
    reset();
    overlay.classList.add('hidden');
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    draw();
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = 'ゲームオーバー';
    overlay.querySelector('p').innerHTML =
      `スコア: <b>${score}</b><br>ハイスコア: <b>${best}</b>`;
    startBtn.textContent = 'もう一度';
  }

  // 入力
  function toCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }
  canvas.addEventListener('pointermove', e => { pointerX = toCanvasX(e.clientX); });
  canvas.addEventListener('pointerdown', e => { pointerX = toCanvasX(e.clientX); });

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = true; pointerX = null; }
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; pointerX = null; }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  });

  startBtn.addEventListener('click', start);

  reset();
  draw();
})();
