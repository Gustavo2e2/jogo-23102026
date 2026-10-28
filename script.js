(() => {
  'use strict';

  // Gato Astronauta — Edição Cósmica 2.0
  // Jogo completo em Canvas, sem bibliotecas obrigatórias.

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    wave: document.getElementById('wave'),
    best: document.getElementById('best'),
    status: document.getElementById('mission-status'),
    power: document.getElementById('power-status'),
    remaining: document.getElementById('remaining'),
    progress: document.getElementById('enemy-progress'),
    missionTitle: document.getElementById('mission-title'),
    missionCopy: document.getElementById('mission-copy'),
    bossCountdown: document.getElementById('boss-countdown'),
    pause: document.getElementById('pause-button'),
    sound: document.getElementById('sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    menu: document.getElementById('menu-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    endScreen: document.getElementById('end-screen'),
    endTitle: document.getElementById('end-title'),
    endKicker: document.getElementById('end-kicker'),
    endMessage: document.getElementById('end-message'),
    endScore: document.getElementById('end-score'),
    endWave: document.getElementById('end-wave'),
    endSymbol: document.getElementById('end-symbol')
  };

  const W = 960;
  const H = 600;
  const STORE_KEY = 'gatoAstronautaRecordeV2';

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let best = readBest();
  let score = 0;
  let lives = 3;
  let wave = 1;
  let mode = 'menu';

  let lastTime = 0;
  let elapsed = 0;
  let soundOn = true;
  let audio = null;

  let enemyDirection = 1;
  let enemyShotTimer = 1.1;
  let waveBanner = '';
  let waveBannerTime = 0;
  let pendingNextWave = false;
  let waveTransition = 0;
  let bossSpawned = false;
  let screenShake = 0;

  const input = {
    left: false,
    right: false,
    fire: false
  };

  const stars = [];
  const enemies = [];
  const playerShots = [];
  const enemyShots = [];
  const particles = [];
  const powerups = [];
  const floatTexts = [];

  let boss = null;
  let backgroundTime = 0;

  const player = {
    x: W / 2,
    y: H - 72,
    w: 54,
    h: 62,
    speed: 455,
    cooldown: 0,
    invulnerable: 0,
    shield: 0,
    rapid: 0,
    muzzle: 0
  };

  // ==============================
  // FUNÇÕES BÁSICAS
  // ==============================

  function readBest() {
    try {
      return Number(localStorage.getItem(STORE_KEY)) || 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(STORE_KEY, String(best));
    } catch (_) {
      // O jogo funciona mesmo sem armazenamento.
    }
  }

  const formatScore = (n) =>
    String(Math.max(0, Math.floor(n))).padStart(6, '0');

  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  const random = (min, max) =>
    Math.random() * (max - min) + min;

  // ==============================
  // CONFIGURAÇÃO DO CANVAS
  // ==============================

  function resizeCanvas() {
    const dpr = Math.max(
      1,
      Math.min(2.5, window.devicePixelRatio || 1)
    );

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  window.addEventListener('resize', resizeCanvas, {
    passive: true
  });

  resizeCanvas();

  // ==============================
  // ESTRELAS DO ESPAÇO
  // ==============================

  function initStars() {
    stars.length = 0;

    for (let i = 0; i < 145; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: random(0.45, 1.7),
        speed: random(8, 34),
        phase: random(0, Math.PI * 2),
        alpha: random(0.22, 0.8),
        tint: Math.random() > 0.78 ? 'cyan' : 'white'
      });
    }
  }

  initStars();

  // ==============================
  // SISTEMA DE SOM
  // ==============================

  function ensureAudio() {
    if (!soundOn) return null;

    if (!audio) {
      const AudioCtx =
        window.AudioContext || window.webkitAudioContext;

      if (AudioCtx) {
        try {
          audio = new AudioCtx();
        } catch (_) {
          audio = null;
        }
      }
    }

    if (audio && audio.state === 'suspended') {
      audio.resume().catch(() => {});
    }

    return audio;
  }

  function tone(
    freq = 440,
    duration = 0.08,
    type = 'sine',
    volume = 0.035,
    endFreq = null,
    delay = 0
  ) {
    if (!soundOn) return;

    const ac = ensureAudio();
    if (!ac) return;

    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      const now = ac.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(
        Math.max(35, freq),
        now
      );

      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(35, endFreq),
          now + duration
        );
      }

      gain.gain.setValueAtTime(0.0001, now);

      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, volume),
        now + 0.012
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + duration
      );

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + duration + 0.025);
    } catch (_) {
      // O jogo continua mesmo se o áudio falhar.
    }
  }

  function sfx(name) {
    if (!soundOn) return;

    switch (name) {
      case 'shoot':
        tone(620, 0.055, 'triangle', 0.018, 290);
        break;

      case 'hit':
        tone(240, 0.09, 'square', 0.026, 100);
        tone(155, 0.12, 'sawtooth', 0.012, 70, 0.035);
        break;

      case 'power':
        tone(390, 0.11, 'sine', 0.035, 650);
        tone(650, 0.15, 'sine', 0.028, 940, 0.085);
        break;

      case 'hurt':
        tone(185, 0.22, 'sawtooth', 0.035, 65);
        break;

      case 'boss':
        tone(120, 0.35, 'sawtooth', 0.028, 80);
        tone(180, 0.28, 'triangle', 0.02, 110, 0.12);
        break;

      case 'clear':
        tone(523, 0.12, 'sine', 0.03, 660);
        tone(659, 0.15, 'sine', 0.03, 784, 0.12);
        tone(784, 0.2, 'sine', 0.03, 1046, 0.24);
        break;

      case 'start':
        tone(330, 0.11, 'triangle', 0.025, 440);
        tone(440, 0.13, 'triangle', 0.025, 660, 0.1);
        break;

      case 'pause':
        tone(440, 0.07, 'sine', 0.02, 330);
        break;
    }
  }

  // ==============================
  // TELAS DO JOGO
  // ==============================

  function showScreen(screenName = null) {
    [
      ui.menu,
      ui.pauseScreen,
      ui.endScreen
    ].forEach((el) => el.classList.remove('active'));

    if (screenName === 'menu') {
      ui.menu.classList.add('active');
    }

    if (screenName === 'paused') {
      ui.pauseScreen.classList.add('active');
    }

    if (screenName === 'over') {
      ui.endScreen.classList.add('active');
    }
  }

  // ==============================
  // PLACAR E INFORMAÇÕES
  // ==============================

  function updateHud() {
    ui.score.textContent = formatScore(score);
    ui.best.textContent = formatScore(best);

    ui.lives.textContent =
      lives > 0 ? '♥ '.repeat(lives).trim() : '♡';

    ui.lives.setAttribute(
      'aria-label',
      `${lives} ${lives === 1 ? 'vida' : 'vidas'}`
    );

    ui.wave.textContent = String(wave).padStart(2, '0');

    const total = enemies.length + (boss ? 1 : 0);

    ui.remaining.textContent = total;

    const fullCount = Math.max(
      1,
      21 + (wave % 4 === 0 ? 1 : 0)
    );

    ui.progress.style.width =
      `${clamp((total / fullCount) * 100, 0, 100)}%`;

    ui.bossCountdown.textContent =
      wave % 4 === 0
        ? (
            boss
              ? 'CHEFE ATIVO'
              : bossSpawned
                ? 'DERROTADO'
                : 'EM BREVE'
          )
        : `SETOR ${String(
            wave + (4 - wave % 4)
          ).padStart(2, '0')}`;

    if (boss) {
      ui.missionTitle.textContent = 'Chefe cósmico';

      ui.missionCopy.textContent =
        'Mire na nave-mãe e sobreviva à chuva de disparos.';
    } else if (wave >= 4) {
      ui.missionTitle.textContent = [
        'Patrulha estelar',
        'Alerta vermelho',
        'Zona de perigo'
      ][Math.min(2, Math.floor((wave - 1) / 3))];

      ui.missionCopy.textContent =
        'A frota está ficando mais rápida. Continue em movimento!';
    } else {
      ui.missionTitle.textContent =
        wave === 1
          ? 'Patrulha estelar'
          : 'Invasão crescente';

      ui.missionCopy.textContent =
        'Elimine os invasores antes que alcancem a sua nave.';
    }

    if (player.rapid > 0) {
      ui.power.textContent =
        `DISPARO TURBO ${Math.ceil(player.rapid)}s`;
    } else if (player.shield > 0) {
      ui.power.textContent =
        `ESCUDO ${Math.ceil(player.shield)}s`;
    } else {
      ui.power.textContent = 'SEM PODER ATIVO';
    }

    ui.status.textContent =
      mode === 'playing'
        ? (boss
            ? 'ALERTA: CHEFE DETECTADO'
            : 'MISSÃO EM ANDAMENTO')
        : mode === 'paused'
          ? 'MISSÃO PAUSADA'
          : mode === 'over'
            ? 'SINAL PERDIDO'
            : 'SISTEMA PRONTO';
  }

  // ==============================
  // INICIAR E REINICIAR
  // ==============================

  function resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    elapsed = 0;

    enemyDirection = 1;
    enemyShotTimer = 1.1;
    boss = null;

    enemies.length = 0;
    playerShots.length = 0;
    enemyShots.length = 0;
    particles.length = 0;
    powerups.length = 0;
    floatTexts.length = 0;

    player.x = W / 2;
    player.cooldown = 0;
    player.invulnerable = 0;
    player.shield = 0;
    player.rapid = 0;
    player.muzzle = 0;

    screenShake = 0;
    pendingNextWave = false;
    waveTransition = 0;
    waveBanner = '';
    waveBannerTime = 0;
    bossSpawned = false;

    input.left = false;
    input.right = false;
    input.fire = false;

    spawnEnemies();

    mode = 'playing';

    showScreen();

    ui.pause.innerHTML =
      '<span aria-hidden="true">Ⅱ</span> Pausar';

    ui.pause.disabled = false;

    updateHud();
    sfx('start');
  }

  // ==============================
  // CRIAR INIMIGOS
  // ==============================

  function spawnEnemies() {
    enemies.length = 0;

    const columns = 7;
    const rows = 3;
    const spacingX = 88;

    const startX =
      (W - ((columns - 1) * spacingX + 44)) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        enemies.push({
          x: startX + col * spacingX,
          y: 82 + row * 57,
          w: 44,
          h: 39,
          row,
          col,
          phase: random(0, Math.PI * 2),
          tint: row,
          alive: true
        });
      }
    }

    enemyDirection = wave % 2 === 0 ? -1 : 1;

    enemyShotTimer = Math.max(
      0.42,
      1.12 - wave * 0.045
    );

    bossSpawned = false;
    pendingNextWave = false;
    waveTransition = 0;

    updateHud();
  }

  function startNextWave() {
    wave += 1;

    spawnEnemies();

    waveBanner =
      `SETOR ${String(wave).padStart(2, '0')} • NOVA FROTA`;

    waveBannerTime = 2.0;

    player.shield = Math.max(player.shield, 0.6);

    sfx('clear');
    updateHud();
  }

  // ==============================
  // CHEFE
  // ==============================

  function spawnBoss() {
    boss = {
      x: W / 2 - 94,
      y: 66,
      w: 188,
      h: 94,
      hp: 28 + wave * 5,
      maxHp: 28 + wave * 5,
      vx:
        (Math.random() > 0.5 ? 1 : -1) *
        (125 + wave * 6),
      shotTimer: 0.9,
      phase: 0
    };

    bossSpawned = true;

    waveBanner = '⚠ NAVE-MÃE DETECTADA ⚠';
    waveBannerTime = 2.4;

    sfx('boss');
    updateHud();
  }

  // ==============================
  // FIM DE JOGO
  // ==============================

  function startGame() {
    ensureAudio();
    resetGame();
  }

  function endGame() {
    mode = 'over';

    input.left = false;
    input.right = false;
    input.fire = false;

    ui.pause.disabled = true;

    ui.endTitle.textContent = 'Missão encerrada';
    ui.endKicker.textContent = 'RELATÓRIO DA MISSÃO';
    ui.endSymbol.textContent = '✦';
    ui.endSymbol.style.color = '#ff8fc7';

    ui.endMessage.textContent =
      score > best * 0.65 && score > 0
        ? 'Que aventura! Você deixou sua marca no universo. O próximo recorde está ao seu alcance.'
        : 'A nave precisa de uma revisão, capitão. Respire fundo e tente conquistar a galáxia novamente!';

    ui.endScore.textContent = formatScore(score);
    ui.endWave.textContent = String(wave).padStart(2, '0');

    showScreen('over');
    updateHud();
  }

  function togglePause() {
    if (mode === 'playing') {
      mode = 'paused';

      input.left = false;
      input.right = false;
      input.fire = false;

      showScreen('paused');

      ui.pause.innerHTML =
        '<span aria-hidden="true">▶</span> Continuar';

      sfx('pause');
    } else if (mode === 'paused') {
      mode = 'playing';

      showScreen();

      ui.pause.innerHTML =
        '<span aria-hidden="true">Ⅱ</span> Pausar';

      sfx('start');
    }

    updateHud();
  }

  // ==============================
  // PONTUAÇÃO E EFEITOS
  // ==============================

  function addScore(amount) {
    score += amount;

    if (score > best) {
      best = score;
      saveBest();
    }

    updateHud();
  }

  function burst(
    x,
    y,
    color,
    count = 12,
    power = 170
  ) {
    const actualCount =
      reducedMotion ? Math.min(5, count) : count;

    for (let i = 0; i < actualCount; i++) {
      const a = random(0, Math.PI * 2);
      const speed = random(power * 0.25, power);

      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: random(0.28, 0.7),
        maxLife: 0.7,
        size: random(1.5, 4),
        color,
        drag: random(0.88, 0.97),
        glow: true
      });
    }
  }

  function addFloatText(
    x,
    y,
    text,
    color = '#8dfbf1',
    size = 16
  ) {
    floatTexts.push({
      x,
      y,
      text,
      color,
      size,
      life: 1,
      maxLife: 1
    });
  }

  // ==============================
  // DISPAROS DO JOGADOR
  // ==============================

  function firePlayerShot() {
    if (mode !== 'playing' || player.cooldown > 0) {
      return;
    }

    const rapid = player.rapid > 0;
    const bulletSpeed = 640;

    if (rapid) {
      playerShots.push({
        x: player.x - 12,
        y: player.y - 23,
        vy: -bulletSpeed,
        r: 4,
        color: '#ffe783',
        damage: 1
      });

      playerShots.push({
        x: player.x + 12,
        y: player.y - 23,
        vy: -bulletSpeed,
        r: 4,
        color: '#ffe783',
        damage: 1
      });

      player.cooldown = 0.15;
    } else {
      playerShots.push({
        x: player.x,
        y: player.y - 25,
        vy: -bulletSpeed,
        r: 4.5,
        color: '#7ff9ed',
        damage: 1
      });

      player.cooldown = 0.26;
    }

    player.muzzle = 0.09;

    if (playerShots.length < 70) {
      sfx('shoot');
    }
  }

  // ==============================
  // COLISÃO
  // ==============================

  function overlap(a, b) {
    const ax = a.x - (a.w || a.r * 2) / 2;
    const ay = a.y - (a.h || a.r * 2) / 2;
    const aw = a.w || a.r * 2;
    const ah = a.h || a.r * 2;

    const bx = b.x - (b.w || b.r * 2) / 2;
    const by = b.y - (b.h || b.r * 2) / 2;
    const bw = b.w || b.r * 2;
    const bh = b.h || b.r * 2;

    return (
      ax < bx + bw &&
      ax + aw > bx &&
      ay < by + bh &&
      ay + ah > by
    );
  }

  // ==============================
  // PODERES ESPECIAIS
  // ==============================

  function maybeDropPower(x, y) {
    if (
      Math.random() >
      Math.min(0.2, 0.115 + wave * 0.004)
    ) {
      return;
    }

    const roll = Math.random();

    let type =
      roll < 0.43
        ? 'rapid'
        : roll < 0.78
          ? 'shield'
          : 'heart';

    if (type === 'heart' && lives >= 5) {
      type = Math.random() < 0.5 ? 'rapid' : 'shield';
    }

    powerups.push({
      x,
      y,
      vy: 82,
      type,
      phase: random(0, Math.PI * 2),
      r: 15
    });
  }

  function destroyEnemy(index) {
    const enemy = enemies[index];

    if (!enemy) return;

    enemies.splice(index, 1);

    const colors = [
      '#ff8cce',
      '#8af6ed',
      '#c4a0ff'
    ];

    burst(
      enemy.x,
      enemy.y,
      colors[enemy.tint % colors.length],
      13,
      190
    );

    addScore(10 * Math.min(wave, 9));

    sfx('hit');

    maybeDropPower(enemy.x, enemy.y);

    if (enemies.length % 7 === 0) {
      addFloatText(
        enemy.x,
        enemy.y - 12,
        '+ COMBO',
        '#ffe18a',
        11
      );
    }

    updateHud();
  }

  function damagePlayer() {
    if (player.invulnerable > 0) return;

    if (player.shield > 0) {
      player.shield = 0;

      burst(
        player.x,
        player.y,
        '#76e8ff',
        23,
        240
      );

      addFloatText(
        player.x,
        player.y - 44,
        'ESCUDO!',
        '#83eaff',
        15
      );

      sfx('power');
      updateHud();

      return;
    }

    lives -= 1;

    player.invulnerable = 1.7;
    player.x = W / 2;

    enemyShots.length = 0;

    burst(
      player.x,
      player.y,
      '#ff7fbb',
      24,
      240
    );

    screenShake = 0.24;

    sfx('hurt');

    addFloatText(
      player.x,
      player.y - 45,
      '-1 VIDA',
      '#ff8cb9',
      16
    );

    if (lives <= 0) {
      updateHud();
      endGame();
    } else {
      updateHud();
    }
  }

  function collectPowerup(power) {
    if (power.type === 'rapid') {
      player.rapid = Math.max(player.rapid, 8.5);

      addFloatText(
        power.x,
        power.y,
        'DISPARO TURBO!',
        '#ffe783',
        13
      );
    } else if (power.type === 'shield') {
      player.shield = Math.max(player.shield, 7.5);

      addFloatText(
        power.x,
        power.y,
        'ESCUDO ATIVO!',
        '#87eaff',
        13
      );
    } else if (power.type === 'heart') {
      lives = Math.min(5, lives + 1);

      addFloatText(
        power.x,
        power.y,
        '+1 VIDA!',
        '#ff8bc9',
        14
      );
    }

    burst(
      power.x,
      power.y,
      power.type === 'rapid'
        ? '#ffe783'
        : power.type === 'shield'
          ? '#87eaff'
          : '#ff8bc9',
      11,
      120
    );

    sfx('power');
    updateHud();
  }

  // ==============================
  // ATUALIZAÇÃO DO JOGO
  // ==============================

  function update(dt) {
    elapsed += dt;
    backgroundTime += dt;

    if (waveBannerTime > 0) {
      waveBannerTime = Math.max(0, waveBannerTime - dt);
    }

    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - dt);
    }

    for (const star of stars) {
      star.y +=
        star.speed * dt *
        (mode === 'playing' ? 1.6 : 0.35);

      if (star.y > H + 2) {
        star.y = -2;
        star.x = Math.random() * W;
      }
    }

    if (mode !== 'playing') {
      updateParticles(dt * 0.7);
      return;
    }

    player.cooldown = Math.max(
      0,
      player.cooldown - dt
    );

    player.invulnerable = Math.max(
      0,
      player.invulnerable - dt
    );

    player.shield = Math.max(
      0,
      player.shield - dt
    );

    player.rapid = Math.max(
      0,
      player.rapid - dt
    );

    player.muzzle = Math.max(
      0,
      player.muzzle - dt
    );

    // Movimento horizontal da nave.
    if (input.left) {
      player.x -= player.speed * dt;
    }

    if (input.right) {
      player.x += player.speed * dt;
    }

    player.x = clamp(player.x, 36, W - 36);

    // Atirar mantendo o botão pressionado.
    if (input.fire) {
      firePlayerShot();
    }

    // Passagem para a próxima onda.
    if (pendingNextWave) {
      waveTransition -= dt;

      if (waveTransition <= 0) {
        startNextWave();
      }
    }

    // Movimento dos inimigos.
    if (enemies.length) {
      const speed =
        (
          36 +
          wave * 7 +
          Math.max(0, 21 - enemies.length) * 1.8
        ) * (wave >= 6 ? 1.12 : 1);

      const margin = 35;

      const edgeHit = enemies.some((e) =>
        e.x + enemyDirection * speed * dt < margin ||
        e.x + e.w + enemyDirection * speed * dt > W - margin
      );

      if (edgeHit) {
        enemyDirection *= -1;

        for (const e of enemies) {
          e.y += 18 + wave * 0.8;
        }
      } else {
        for (const e of enemies) {
          e.x += enemyDirection * speed * dt;

          e.y +=
            Math.sin(elapsed * 2.3 + e.phase) *
            dt * 2.3;
        }
      }

      // Se a frota chegar perto demais, a nave perde vida.
      if (
        enemies.some(
          (e) => e.y + e.h / 2 >= player.y - 34
        )
      ) {
        damagePlayer();

        if (mode === 'playing') {
          for (let i = 0; i < enemies.length; i++) {
            enemies[i].y =
              76 + Math.floor(i / 7) * 57;
          }

          enemyDirection *= -1;
        }
      }

      // Inimigos disparam contra o jogador.
      enemyShotTimer -= dt;

      const fireInterval = Math.max(
        0.42,
        1.35 - wave * 0.055
      );

      if (enemyShotTimer <= 0 && enemies.length) {
        const candidates = enemies.filter(
          (e) =>
            !enemies.some(
              (other) =>
                other.col === e.col &&
                other.y > e.y
            )
        );

        const shooter =
          candidates[
            Math.floor(
              Math.random() *
              Math.max(1, candidates.length)
            )
          ] || enemies[0];

        enemyShots.push({
          x: shooter.x,
          y: shooter.y + 16,
          vx: random(-24, 24),
          vy: 205 + wave * 15,
          r: 5,
          color: '#ff84cb'
        });

        enemyShotTimer = random(
          fireInterval * 0.7,
          fireInterval * 1.22
        );
      }
    }

    // Chefes surgem a cada quatro setores.
    if (
      !pendingNextWave &&
      enemies.length === 0 &&
      !boss
    ) {
      if (wave % 4 === 0 && !bossSpawned) {
        spawnBoss();
      } else {
        pendingNextWave = true;
        waveTransition = 1.3;

        waveBanner = 'SETOR LIMPO • + BÔNUS';
        waveBannerTime = 1.5;

        addScore(100 + wave * 20);

        sfx('clear');
      }
    }

    // Movimento e ataques do chefe.
    if (boss) {
      boss.phase += dt;
      boss.x += boss.vx * dt;

      if (
        boss.x < 40 ||
        boss.x + boss.w > W - 40
      ) {
        boss.vx *= -1;

        boss.x = clamp(
          boss.x,
          40,
          W - boss.w - 40
        );
      }

      boss.y = 66 + Math.sin(boss.phase * 1.8) * 8;

      boss.shotTimer -= dt;

      if (boss.shotTimer <= 0) {
        const centerX = boss.x + boss.w / 2;

        enemyShots.push({
          x: centerX - 26,
          y: boss.y + boss.h * 0.36,
          vx: -45,
          vy: 220 + wave * 12,
          r: 7,
          color: '#ff5f9d'
        });

        enemyShots.push({
          x: centerX,
          y: boss.y + boss.h * 0.42,
          vx: (player.x - centerX) * 0.22,
          vy: 235 + wave * 12,
          r: 7,
          color: '#ff5f9d'
        });

        enemyShots.push({
          x: centerX + 26,
          y: boss.y + boss.h * 0.36,
          vx: 45,
          vy: 220 + wave * 12,
          r: 7,
          color: '#ff5f9d'
        });

        boss.shotTimer = Math.max(
          0.55,
          1.25 - wave * 0.025
        );
      }
    }

    // Atualiza os tiros do jogador e detecta colisões.
    for (let i = playerShots.length - 1; i >= 0; i--) {
      const shot = playerShots[i];

      shot.y += shot.vy * dt;

      let removed = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];

        if (
          Math.abs(shot.x - e.x) < e.w * 0.52 &&
          Math.abs(shot.y - e.y) < e.h * 0.56
        ) {
          destroyEnemy(j);
          playerShots.splice(i, 1);
          removed = true;
          break;
        }
      }

      if (removed) continue;

      // Acertar o chefe.
      if (
        boss &&
        shot.x > boss.x - 2 &&
        shot.x < boss.x + boss.w + 2 &&
        shot.y > boss.y - 4 &&
        shot.y < boss.y + boss.h
      ) {
        boss.hp -= shot.damage;

        burst(
          shot.x,
          shot.y,
          '#bba1ff',
          3,
          65
        );

        playerShots.splice(i, 1);

        if (boss.hp <= 0) {
          burst(
            boss.x + boss.w / 2,
            boss.y + boss.h / 2,
            '#ff8dcd',
            44,
            290
          );

          addScore(500 + wave * 100);

          addFloatText(
            boss.x + boss.w / 2,
            boss.y,
            'CHEFE DERROTADO!',
            '#ffe783',
            18
          );

          boss = null;
          pendingNextWave = true;
          waveTransition = 2;

          waveBanner =
            'CHEFE DERROTADO • + RECOMPENSA';

          waveBannerTime = 2.2;

          sfx('clear');
          updateHud();
        }

        continue;
      }

      // Remove tiros que saíram da tela.
      if (shot.y < -15) {
        playerShots.splice(i, 1);
      }
    }

    // Tiros inimigos atingindo a nave.
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const shot = enemyShots[i];

      shot.x += (shot.vx || 0) * dt;
      shot.y += shot.vy * dt;

      if (
        shot.y > H + 18 ||
        shot.x < -20 ||
        shot.x > W + 20
      ) {
        enemyShots.splice(i, 1);
        continue;
      }

      const near =
        Math.abs(shot.x - player.x) < 24 &&
        Math.abs(shot.y - player.y) < 27;

      if (near) {
        enemyShots.splice(i, 1);

        damagePlayer();

        if (mode !== 'playing') break;
      }
    }

    // Movimento e coleta dos poderes.
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];

      p.y += p.vy * dt;
      p.phase += dt * 3;

      if (
        Math.abs(p.x - player.x) < 33 &&
        Math.abs(p.y - player.y) < 34
      ) {
        collectPowerup(p);
        powerups.splice(i, 1);
        continue;
      }

      if (p.y > H + 20) {
        powerups.splice(i, 1);
      }
    }

    updateParticles(dt);
    updateHud();
  }

  // ==============================
  // PARTÍCULAS E TEXTOS FLUTUANTES
  // ==============================

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.life -= dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.vx *= Math.pow(p.drag || 0.95, dt * 60);
      p.vy *= Math.pow(p.drag || 0.95, dt * 60);
    }

    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];

      f.life -= dt;
      f.y -= 24 * dt;

      if (f.life <= 0) {
        floatTexts.splice(i, 1);
      }
    }
  }

  // ==============================
  // FUNDO ESPACIAL
  // ==============================

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);

    gradient.addColorStop(0, '#080c28');
    gradient.addColorStop(0.52, '#11143c');
    gradient.addColorStop(1, '#090e28');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Nebulosas coloridas.
    const nebulae = [
      {
        x: 145,
        y: 145,
        r: 210,
        c: 'rgba(100,72,215,.12)'
      },
      {
        x: 765,
        y: 275,
        r: 260,
        c: 'rgba(39,174,201,.075)'
      },
      {
        x: 470,
        y: 510,
        r: 230,
        c: 'rgba(157,78,190,.07)'
      }
    ];

    for (const n of nebulae) {
      const g = ctx.createRadialGradient(
        n.x,
        n.y,
        0,
        n.x,
        n.y,
        n.r
      );

      g.addColorStop(0, n.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = g;

      ctx.fillRect(
        n.x - n.r,
        n.y - n.r,
        n.r * 2,
        n.r * 2
      );
    }

    // Planeta distante.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(814, 96);
    ctx.rotate(-0.21);

    ctx.strokeStyle = 'rgba(160,142,255,.32)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(0, 0, 89, 25, 0, 0, Math.PI * 2);
    ctx.stroke();

    const pg = ctx.createRadialGradient(
      -15, -20, 3,
      0, 0, 68
    );

    pg.addColorStop(0, '#4d6dc0');
    pg.addColorStop(0.6, '#332e80');
    pg.addColorStop(1, '#171b52');

    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, 57, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180,176,255,.17)';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(-8, 1, 43, -0.7, 1.7);
    ctx.stroke();

    ctx.restore();

    // Estrelas piscando.
    for (const s of stars) {
      const blink =
        0.64 + Math.sin(backgroundTime * 2.2 + s.phase) * 0.27;

      ctx.globalAlpha = s.alpha * blink;

      ctx.fillStyle =
        s.tint === 'cyan' ? '#8efaff' : '#e2e7ff';

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.r > 1.35) {
        ctx.globalAlpha *= 0.4;
        ctx.fillRect(
          s.x - s.r * 2,
          s.y - 0.4,
          s.r * 4,
          0.8
        );
      }
    }

    ctx.globalAlpha = 1;

    // Grade futurista na parte inferior.
    ctx.save();

    ctx.strokeStyle = 'rgba(99,132,255,.085)';
    ctx.lineWidth = 1;

    const horizon = 420;

    for (let i = 0; i < 12; i++) {
      const y =
        horizon +
        i * i * 1.55 +
        ((backgroundTime * 17) % 10);

      if (y < H) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(W / 2 + i * 105, H);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ==============================
  // DESENHAR NAVE COM GATINHO
  // ==============================

  function drawCatShip(x, y, scale = 1) {
    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const flameLen =
      13 +
      Math.sin(elapsed * 28) * 5 +
      (player.muzzle > 0 ? 8 : 0);

    // Chama do propulsor.
    const fire = ctx.createLinearGradient(
      0, 18,
      0, 18 + flameLen + 10
    );

    fire.addColorStop(0, '#fff4ac');
    fire.addColorStop(0.38, '#ffad64');
    fire.addColorStop(1, 'rgba(255,84,143,0)');

    ctx.fillStyle = fire;

    ctx.beginPath();
    ctx.moveTo(-10, 17);
    ctx.quadraticCurveTo(-8, 21 + flameLen, 0, 26 + flameLen);
    ctx.quadraticCurveTo(8, 21 + flameLen, 10, 17);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffda8a';

    ctx.beginPath();
    ctx.moveTo(-4, 17);
    ctx.quadraticCurveTo(-3, 22 + flameLen * 0.62, 0, 21 + flameLen * 0.73);
    ctx.quadraticCurveTo(3, 22 + flameLen * 0.62, 4, 17);
    ctx.closePath();
    ctx.fill();

    // Asas.
    ctx.fillStyle = '#667bd0';
    ctx.strokeStyle = '#a6b8ff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-29, 20);
    ctx.lineTo(-24, -1);
    ctx.lineTo(-13, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(29, 20);
    ctx.lineTo(24, -1);
    ctx.lineTo(13, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7ff8ee';

    ctx.beginPath();
    ctx.arc(-22, 8, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(22, 8, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Corpo metálico.
    const hull = ctx.createLinearGradient(-20, 0, 20, 0);

    hull.addColorStop(0, '#697de1');
    hull.addColorStop(0.35, '#f5f4ff');
    hull.addColorStop(0.62, '#b4c8ff');
    hull.addColorStop(1, '#6a76ce');

    ctx.fillStyle = hull;
    ctx.strokeStyle = '#d6e3ff';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(18, -12, 18, 10);
    ctx.lineTo(13, 22);
    ctx.quadraticCurveTo(0, 28, -13, 22);
    ctx.lineTo(-18, 10);
    ctx.quadraticCurveTo(-18, -12, 0, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#737ed5';

    ctx.beginPath();
    ctx.ellipse(0, 17, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabine de vidro.
    ctx.save();

    ctx.shadowColor = '#69e9ff';
    ctx.shadowBlur = 13;

    const glass = ctx.createLinearGradient(0, -27, 0, 9);

    glass.addColorStop(0, '#a4fcff');
    glass.addColorStop(0.35, '#679fe7');
    glass.addColorStop(1, '#322e7b');

    ctx.fillStyle = glass;
    ctx.strokeStyle = '#cafbff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(0, -8, 15.5, 17.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Orelhas.
    ctx.fillStyle = '#fff4e7';
    ctx.strokeStyle = '#ffdccd';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(-10, -15);
    ctx.lineTo(-9, -24);
    ctx.lineTo(-2, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(2, -18);
    ctx.lineTo(9, -24);
    ctx.lineTo(10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rosto.
    ctx.fillStyle = '#fff6ed';

    ctx.beginPath();
    ctx.ellipse(0, -9, 10.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b3d72';

    ctx.beginPath();
    ctx.ellipse(-4, -10, 1.7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(4, -10, 1.7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nariz.
    ctx.fillStyle = '#ff9abf';

    ctx.beginPath();
    ctx.moveTo(-1.7, -5.7);
    ctx.lineTo(1.7, -5.7);
    ctx.lineTo(0, -3.7);
    ctx.closePath();
    ctx.fill();

    // Boca.
    ctx.strokeStyle = '#9f6681';
    ctx.lineWidth = 0.8;

    ctx.beginPath();
    ctx.moveTo(0, -3.8);
    ctx.lineTo(0, -1.5);
    ctx.quadraticCurveTo(-3, 1, -4, -1);

    ctx.moveTo(0, -1.5);
    ctx.quadraticCurveTo(3, 1, 4, -1);
    ctx.stroke();

    // Bigodes.
    ctx.strokeStyle = 'rgba(255,255,255,.85)';

    for (const side of [-1, 1]) {
      ctx.beginPath();

      ctx.moveTo(side * 5, -5);
      ctx.lineTo(side * 11, -7);

      ctx.moveTo(side * 5, -3);
      ctx.lineTo(side * 10, -2);

      ctx.stroke();
    }

    // Luzes da nave.
    ctx.fillStyle = '#ffe18a';

    ctx.beginPath();
    ctx.arc(0, 11, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#79f5ea';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', 0, 5);

    // Brilho de disparo.
    if (player.muzzle > 0) {
      ctx.globalAlpha = player.muzzle / 0.09;
      ctx.fillStyle = '#d6ffff';
      ctx.shadowColor = '#8ffff7';
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.ellipse(0, -34, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Escudo ao redor da nave.
    if (player.shield > 0) {
      ctx.globalAlpha =
        0.47 + Math.sin(elapsed * 8) * 0.12;

      ctx.strokeStyle = '#7deeff';
      ctx.lineWidth = 2.3;
      ctx.shadowColor = '#6ceeff';
      ctx.shadowBlur = 17;

      ctx.beginPath();
      ctx.ellipse(0, 0, 37, 43, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#6ceeff';
      ctx.fill();
    }

    ctx.restore();
  }

  // ==============================
  // DESENHAR RATINHOS INIMIGOS
  // ==============================

  function drawMouse(enemy) {
    const bob =
      Math.sin(elapsed * 3.2 + enemy.phase) * 2.1;

    ctx.save();

    ctx.translate(enemy.x, enemy.y + bob);

    const palette = [
      {
        body: '#ff8dca',
        ear: '#ffb0d8',
        dark: '#a34b9f',
        eye: '#46265e'
      },
      {
        body: '#83eee5',
        ear: '#bcfff6',
        dark: '#337fa0',
        eye: '#194c72'
      },
      {
        body: '#b4a1ff',
        ear: '#d9caff',
        dark: '#6551af',
        eye: '#3b2a77'
      }
    ][enemy.tint % 3];

    ctx.shadowColor = palette.body;
    ctx.shadowBlur = 8;

    // Antenas.
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(-14, -23, -6, -25);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.quadraticCurveTo(14, -23, 6, -25);
    ctx.stroke();

    ctx.fillStyle = '#ffe88d';

    ctx.beginPath();
    ctx.arc(-6, -25, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(6, -25, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Orelhas.
    ctx.fillStyle = palette.ear;

    ctx.beginPath();
    ctx.ellipse(-15, -10, 8, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(15, -10, 8, 10, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Corpo.
    ctx.fillStyle = palette.body;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = 1.7;

    ctx.beginPath();
    ctx.ellipse(0, 1, 20, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Barriga.
    ctx.fillStyle = 'rgba(255,255,255,.35)';

    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cinto.
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-11, 13, 22, 5);

    ctx.fillStyle = '#ffe98c';
    ctx.fillRect(-3, 13, 6, 5);

    // Olhos.
    ctx.fillStyle = '#fff';

    ctx.beginPath();
    ctx.ellipse(-7, -2, 4.2, 5, -0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(7, -2, 4.2, 5, 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.eye;

    ctx.beginPath();
    ctx.arc(-6, -1, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(8, -1, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';

    ctx.beginPath();
    ctx.arc(-6.7, -2, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(7.3, -2, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Nariz e boca.
    ctx.fillStyle = '#ffebf5';

    ctx.beginPath();
    ctx.moveTo(-2.3, 5);
    ctx.lineTo(2.3, 5);
    ctx.lineTo(0, 7.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(-3, 8);
    ctx.quadraticCurveTo(0, 11, 3, 8);
    ctx.stroke();

    // Bigodes.
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 0.7;

    ctx.beginPath();
    ctx.moveTo(-11, 5);
    ctx.lineTo(-20, 3);

    ctx.moveTo(-11, 8);
    ctx.lineTo(-19, 9);

    ctx.moveTo(11, 5);
    ctx.lineTo(20, 3);

    ctx.moveTo(11, 8);
    ctx.lineTo(19, 9);

    ctx.stroke();

    ctx.restore();
  }

  // ==============================
  // DESENHAR CHEFE
  // ==============================

  function drawBoss() {
    if (!boss) return;

    ctx.save();

    ctx.translate(boss.x, boss.y);

    ctx.shadowColor = '#ff5fba';
    ctx.shadowBlur = 24;

    const metal = ctx.createLinearGradient(
      0, 0,
      0, boss.h
    );

    metal.addColorStop(0, '#f48bd4');
    metal.addColorStop(0.33, '#6854ba');
    metal.addColorStop(1, '#24255b');

    ctx.fillStyle = metal;
    ctx.strokeStyle = '#ffc0ee';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(16, 15);
    ctx.quadraticCurveTo(30, -2, 58, 8);
    ctx.lineTo(130, 8);
    ctx.quadraticCurveTo(158, -2, 172, 15);
    ctx.lineTo(188, 54);
    ctx.lineTo(153, 70);
    ctx.lineTo(35, 70);
    ctx.lineTo(0, 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = '#4e4a9d';

    ctx.beginPath();
    ctx.ellipse(94, 45, 60, 27, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff5a9e';
    ctx.shadowColor = '#ff5a9e';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.ellipse(94, 42, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff1ac';

    ctx.beginPath();
    ctx.arc(94, 41, 5, 0, Math.PI * 2);
    ctx.fill();

    // Luzes do chefe.
    for (let i = 0; i < 5; i++) {
      const x = 34 + i * 30;

      ctx.fillStyle = i % 2 ? '#8bf7ff' : '#ffdb84';

      ctx.beginPath();
      ctx.arc(x, 19, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Asas.
    ctx.fillStyle = '#ff7cbf';

    ctx.beginPath();
    ctx.moveTo(22, 62);
    ctx.lineTo(11, 82);
    ctx.lineTo(44, 68);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(166, 62);
    ctx.lineTo(177, 82);
    ctx.lineTo(144, 68);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Barra de vida do chefe.
    const barX = W / 2 - 170;
    const barY = 25;
    const barW = 340;

    ctx.fillStyle = 'rgba(4,6,22,.8)';
    roundedRect(ctx, barX, barY, barW, 10, 5);
    ctx.fill();

    const health = clamp(
      boss.hp / boss.maxHp,
      0,
      1
    );

    const hpGradient = ctx.createLinearGradient(
      barX, 0,
      barX + barW, 0
    );

    hpGradient.addColorStop(0, '#ff6dad');
    hpGradient.addColorStop(1, '#ffc4ed');

    ctx.fillStyle = hpGradient;

    roundedRect(
      ctx,
      barX + 2,
      barY + 2,
      (barW - 4) * health,
      6,
      4
    );

    ctx.fill();

    ctx.fillStyle = '#f4d8ff';
    ctx.font = '700 10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      'NAVE-MÃE • INTEGRIDADE',
      W / 2,
      barY - 7
    );
  }

  // ==============================
  // FORMAS ARREDONDADAS
  // ==============================

  function roundedRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);

    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  // ==============================
  // DESENHAR TIROS
  // ==============================

  function drawShots() {
    // Tiros do jogador.
    for (const shot of playerShots) {
      ctx.save();

      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = shot.color;

      roundedRect(
        ctx,
        shot.x - 2.2,
        shot.y - 9,
        4.4,
        15,
        3
      );

      ctx.fill();

      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#fff';

      roundedRect(
        ctx,
        shot.x - 0.8,
        shot.y - 7,
        1.6,
        8,
        1
      );

      ctx.fill();
      ctx.restore();
    }

    // Tiros dos inimigos.
    for (const shot of enemyShots) {
      ctx.save();

      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 13;
      ctx.fillStyle = shot.color;

      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff4ff';

      ctx.beginPath();
      ctx.arc(
        shot.x - 1,
        shot.y - 1.5,
        shot.r * 0.36,
        0,
        Math.PI * 2
      );

      ctx.fill();
      ctx.restore();
    }
  }

  // ==============================
  // DESENHAR PODERES
  // ==============================

  function drawPowerups() {
    for (const p of powerups) {
      ctx.save();

      ctx.translate(
        p.x,
        p.y + Math.sin(p.phase) * 4
      );

      ctx.rotate(Math.sin(p.phase * 0.5) * 0.12);

      const color =
        p.type === 'rapid'
          ? '#ffe27c'
          : p.type === 'shield'
            ? '#7cecff'
            : '#ff8cc8';

      ctx.shadowColor = color;
      ctx.shadowBlur = 17;

      ctx.fillStyle = 'rgba(11,18,48,.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 18px sans-serif';

      ctx.fillText(
        p.type === 'rapid'
          ? 'ϟ'
          : p.type === 'shield'
            ? '⬡'
            : '♥',
        0,
        1
      );

      ctx.restore();
    }
  }

  // ==============================
  // DESENHAR EXPLOSÕES E EFEITOS
  // ==============================

  function drawEffects() {
    ctx.save();

    ctx.globalCompositeOperation = 'lighter';

    for (const p of particles) {
      ctx.globalAlpha = clamp(
        p.life / p.maxLife,
        0,
        1
      );

      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 9;
      }

      ctx.fillStyle = p.color;

      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        p.size * Math.max(0.25, p.life / p.maxLife),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    // Pontuação flutuante.
    for (const f of floatTexts) {
      ctx.save();

      ctx.globalAlpha = clamp(
        f.life / f.maxLife,
        0,
        1
      );

      ctx.fillStyle = f.color;

      ctx.font =
        `700 ${f.size}px "Space Grotesk", sans-serif`;

      ctx.textAlign = 'center';
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;

      ctx.fillText(f.text, f.x, f.y);

      ctx.restore();
    }
  }

  // ==============================
  // AVISOS DAS ONDAS
  // ==============================

  function drawBanner() {
    if (waveBannerTime <= 0 || !waveBanner) {
      return;
    }

    const fade = Math.min(1, waveBannerTime * 2.5);

    ctx.save();
    ctx.globalAlpha = fade;

    const width = Math.min(
      490,
      Math.max(280, waveBanner.length * 10 + 45)
    );

    const x = W / 2 - width / 2;
    const y = boss ? 132 : 235;

    ctx.fillStyle = 'rgba(8,12,36,.86)';

    roundedRect(ctx, x, y, width, 45, 13);
    ctx.fill();

    ctx.strokeStyle =
      waveBanner.includes('CHEFE') ||
      waveBanner.includes('NAVE-MÃE')
        ? 'rgba(255,123,201,.7)'
        : 'rgba(113,245,237,.55)';

    ctx.lineWidth = 1.2;

    roundedRect(ctx, x, y, width, 45, 13);
    ctx.stroke();

    ctx.fillStyle = '#f3f4ff';
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      waveBanner,
      W / 2,
      y + 23
    );

    ctx.restore();
  }

  // ==============================
  // DESENHAR QUADRO COMPLETO
  // ==============================

  function draw() {
    ctx.save();

    if (screenShake > 0 && !reducedMotion) {
      ctx.translate(
        random(-5, 5) * screenShake / 0.24,
        random(-4, 4) * screenShake / 0.24
      );
    }

    drawBackground();

    for (const enemy of enemies) {
      drawMouse(enemy);
    }

    drawBoss();
    drawPowerups();
    drawShots();
    drawEffects();

    if (mode !== 'over') {
      const visible =
        player.invulnerable <= 0 ||
        Math.floor(elapsed * 14) % 2 === 0;

      if (visible) {
        drawCatShip(player.x, player.y);
      }
    }

    drawBanner();

    ctx.restore();
  }

  // ==============================
  // CICLO PRINCIPAL
  // ==============================

  function frame(now) {
    if (!lastTime) {
      lastTime = now;
    }

    const dt = Math.min(
      0.034,
      Math.max(0, (now - lastTime) / 1000)
    );

    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(frame);
  }

  // ==============================
  // CONTROLES DO TECLADO
  // ==============================

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (
      [
        'arrowleft',
        'arrowright',
        ' ',
        'arrowup',
        'arrowdown'
      ].includes(key)
    ) {
      event.preventDefault();
    }

    if (key === 'arrowleft' || key === 'a') {
      input.left = true;
    }

    if (key === 'arrowright' || key === 'd') {
      input.right = true;
    }

    if (key === ' ' || key === 'arrowup') {
      input.fire = true;
    }

    if (
      (key === 'p' || key === 'escape') &&
      !event.repeat
    ) {
      togglePause();
    }

    if (
      (key === 'enter' || key === ' ') &&
      (mode === 'menu' || mode === 'over') &&
      !event.repeat &&
      document.activeElement.tagName !== 'BUTTON'
    ) {
      startGame();
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'arrowleft' || key === 'a') {
      input.left = false;
    }

    if (key === 'arrowright' || key === 'd') {
      input.right = false;
    }

    if (key === ' ' || key === 'arrowup') {
      input.fire = false;
    }
  });

  // Pausa automática ao sair da janela.
  window.addEventListener('blur', () => {
    input.left = false;
    input.right = false;
    input.fire = false;

    if (mode === 'playing') {
      togglePause();
    }
  });

  // ==============================
  // CONTROLES PARA CELULAR
  // ==============================

  function bindHoldButton(id, action) {
    const button = document.getElementById(id);

    let pointer = null;

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();

      pointer = event.pointerId;

      try {
        button.setPointerCapture(pointer);
      } catch (_) {
        // Captura pode não estar disponível.
      }

      action(true);

      button.classList.add('pressed');

      ensureAudio();
    });

    const release = (event) => {
      if (
        pointer !== null &&
        (!event || event.pointerId === pointer)
      ) {
        action(false);
        button.classList.remove('pressed');
        pointer = null;
      }
    };

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);

    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  bindHoldButton('btn-esq', (down) => {
    input.left = down;
  });

  bindHoldButton('btn-dir', (down) => {
    input.right = down;
  });

  bindHoldButton('btn-atirar', (down) => {
    input.fire = down;
  });

  // ==============================
  // BOTÕES DAS TELAS
  // ==============================

  document
    .getElementById('start-button')
    .addEventListener('click', startGame);

  document
    .getElementById('restart-button')
    .addEventListener('click', startGame);

  document
    .getElementById('pause-restart-button')
    .addEventListener('click', startGame);

  document
    .getElementById('resume-button')
    .addEventListener('click', togglePause);

  document
    .getElementById('menu-button')
    .addEventListener('click', () => {
      mode = 'menu';

      input.left = false;
      input.right = false;
      input.fire = false;

      ui.pause.disabled = true;

      ui.pause.innerHTML =
        '<span aria-hidden="true">Ⅱ</span> Pausar';

      showScreen('menu');
      updateHud();
    });

  // Botão de pausa.
  ui.pause.addEventListener('click', togglePause);

  // Botão para ativar ou desativar os sons.
  ui.sound.addEventListener('click', () => {
    soundOn = !soundOn;

    ui.sound.setAttribute(
      'aria-pressed',
      String(soundOn)
    );

    ui.sound.title =
      soundOn ? 'Desativar sons' : 'Ativar sons';

    ui.soundIcon.textContent =
      soundOn ? '♫' : '∅';

    if (soundOn) {
      ensureAudio();
      sfx('power');
    }
  });

  // Preparar o jogo e iniciar a animação.
  updateHud();

  requestAnimationFrame(frame);
})();