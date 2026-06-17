/**
 * FILL THE BUCKET! — Game Logic
 * charity: water inspired browser game
 *
 * ============================================================
 * EASY TO EDIT — Configuration is at the top of this file
 * ============================================================
 */

// ============================================================
//   GAME CONFIGURATION
//   Edit these values to change gameplay behaviour
// ============================================================
const CONFIG = {
  // How many seconds the game lasts
  gameDuration: 60,

  // Points gained per clean drop caught
  pointsPerClean: 10,

  // How much each clean drop fills the bucket (%)
  bucketFillPerDrop: 5,

  // How much each dirty drop fills the dirty meter (%)
  dirtyPerDrop: 8,

  // Speed of the bucket when arrow keys / buttons are held (px per frame)
  bucketSpeed: {
    easy:   7,
    normal: 9,
    hard:   11,
  },

  // How fast drops fall (px per frame)
  dropSpeed: {
    easy:   2.5,
    normal: 3.5,
    hard:   5,
  },

  // Milliseconds between new drops spawning
  spawnInterval: {
    easy:   1200,
    normal: 900,
    hard:   650,
  },

  // Ratio of dirty drops (0 = none, 1 = all dirty)
  dirtyRatio: {
    easy:   0.25,
    normal: 0.35,
    hard:   0.5,
  },

  // Width of the bucket in px (must match CSS)
  bucketWidth: 72,

  // Score threshold for a "win" (bucket full)
  winScore: 100,
};

// ============================================================
//   GAME STATE
// ============================================================
let state = {
  screen:       'start',  // 'start' | 'game' | 'end' | 'learn' | 'options'
  score:        0,
  bucketFill:   0,         // 0-100 %
  dirtyFill:    0,         // 0-100 %
  timeLeft:     CONFIG.gameDuration,
  bucketX:      50,        // % across game area
  drops:        [],
  running:      false,
  soundOn:      true,
  difficulty:   'easy',
  lastTime:     null,
  animFrame:    null,
  timerInterval: null,
  spawnTimeout: null,
  gameAreaW:    0,
  gameAreaH:    0,
  prevScreen:   'start',  // for back navigation
};

// ============================================================
//   DOM REFERENCES
// ============================================================
const $ = id => document.getElementById(id);

const screens = {
  start:   $('screen-start'),
  game:    $('screen-game'),
  end:     $('screen-end'),
  learn:   $('screen-learn'),
  options: $('screen-options'),
};

const dom = {
  timerDisplay:   $('timer-display'),
  scoreDisplay:   $('score-display'),
  bucketFillPct:  $('bucket-fill-pct'),
  dirtyPct:       $('dirty-pct'),
  bucketFillBar:  $('bucket-fill-bar'),
  dirtyBar:       $('dirty-bar'),
  gameArea:       $('game-area'),
  dropsContainer: $('drops-container'),
  bucket:         $('bucket'),
  bucketLiquid:   $('bucket-liquid'),
  guideLine:      $('guide-line'),
  endIcon:        $('end-icon'),
  endTitle:       $('end-title'),
  endMessage:     $('end-message'),
  endScore:       $('end-score'),
  endBucket:      $('end-bucket'),
  endDirty:       $('end-dirty'),
};

// ============================================================
//   AUDIO — Simple Web Audio tones (no external files needed)
// ============================================================
let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

function playTone(freq, type, duration, vol) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudio();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.15));
    osc.start();
    osc.stop(ctx.currentTime + (duration || 0.15));
  } catch(e) {}
}

function playCleanCatch()  { playTone(660, 'sine',    0.18, 0.2); }
function playDirtyCatch()  { playTone(180, 'sawtooth', 0.2, 0.15); }
function playGameOver()    {
  playTone(220, 'sawtooth', 0.3, 0.2);
  setTimeout(() => playTone(160, 'sawtooth', 0.5, 0.2), 150);
}
function playWin() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3, 0.2), i * 120));
}

// ============================================================
//   SCREEN NAVIGATION
// ============================================================
function showScreen(name) {
  Object.keys(screens).forEach(k => screens[k].classList.remove('active'));
  screens[name].classList.add('active');
  state.prevScreen = state.screen;
  state.screen = name;
}

// ============================================================
//   MEASURE GAME AREA
// ============================================================
function measureGameArea() {
  const r = dom.gameArea.getBoundingClientRect();
  state.gameAreaW = r.width;
  state.gameAreaH = r.height;
  // Position guide line where bucket rides
  const guideY = state.gameAreaH - 14 - 60 - 6;
  dom.guideLine.style.top = guideY + 'px';
  // Update bucket position
  setBucketX(state.bucketX);
}

// ============================================================
//   BUCKET POSITION
// ============================================================
function setBucketX(pct) {
  state.bucketX = Math.max(0, Math.min(100, pct));
  const halfW = (CONFIG.bucketWidth / 2) / state.gameAreaW * 100;
  const clampedPct = Math.max(halfW, Math.min(100 - halfW, state.bucketX));
  const px = (clampedPct / 100) * state.gameAreaW;
  dom.bucket.style.left = px + 'px';
}

// ============================================================
//   DROP MANAGEMENT
// ============================================================
let dropIdCounter = 0;

function spawnDrop() {
  if (!state.running) return;

  const isClean = Math.random() > CONFIG.dirtyRatio[state.difficulty];
  const id      = 'drop-' + (++dropIdCounter);

  // Random horizontal position (avoid very edges)
  const xPct = 8 + Math.random() * 84;
  const xPx  = (xPct / 100) * state.gameAreaW;

  // Create DOM element
  const el = document.createElement('div');
  el.className = 'drop ' + (isClean ? 'clean' : 'dirty');
  el.id = id;

  const inner = document.createElement('div');
  inner.className = 'drop-inner';
  el.appendChild(inner);

  el.style.left = xPx + 'px';
  el.style.top  = '-40px';
  dom.dropsContainer.appendChild(el);

  state.drops.push({
    id,
    el,
    isClean,
    x: xPx,
    y: -40,
    caught: false,
  });

  // Schedule next drop
  const interval = CONFIG.spawnInterval[state.difficulty];
  const jitter   = interval * 0.4;
  state.spawnTimeout = setTimeout(spawnDrop, interval - jitter * 0.5 + Math.random() * jitter);
}

function removeDrop(drop) {
  drop.el.remove();
  state.drops = state.drops.filter(d => d !== drop);
}

// ============================================================
//   COLLISION DETECTION
// ============================================================
function getBucketRect() {
  const halfW = CONFIG.bucketWidth / 2;
  const bx    = (state.bucketX / 100) * state.gameAreaW;
  const by    = state.gameAreaH - 14 - 60;
  return {
    left:  bx - halfW,
    right: bx + halfW,
    top:   by,
    bottom: by + 60,
  };
}

function checkCollision(drop) {
  const bkt  = getBucketRect();
  const dropW = 32;
  const dropH = 38;
  const dleft  = drop.x;
  const dright = drop.x + dropW;
  const dtop   = drop.y;
  const dbottom = drop.y + dropH;

  return (
    dright  > bkt.left &&
    dleft   < bkt.right &&
    dbottom > bkt.top &&
    dtop    < bkt.bottom
  );
}

// ============================================================
//   SCORE POP-UP ANIMATION
// ============================================================
function showScorePop(x, y, text, className) {
  const el = document.createElement('div');
  el.className = 'score-pop ' + className;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  dom.gameArea.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ============================================================
//   GAME LOOP
// ============================================================
function gameLoop(timestamp) {
  if (!state.running) return;

  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 16.67, 3) : 1;
  state.lastTime = timestamp;

  const speed = CONFIG.dropSpeed[state.difficulty] * dt;

  // Move drops downward
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const drop = state.drops[i];
    if (drop.caught) continue;

    drop.y += speed;
    drop.el.style.top = drop.y + 'px';

    // Check if caught by bucket
    if (checkCollision(drop)) {
      drop.caught = true;
      drop.el.classList.add('caught');

      const px = drop.x + 16;
      const py = state.gameAreaH - 90;

      if (drop.isClean) {
        // Clean drop caught
        state.score       += CONFIG.pointsPerClean;
        state.bucketFill  = Math.min(100, state.bucketFill + CONFIG.bucketFillPerDrop);
        showScorePop(px, py, '+' + CONFIG.pointsPerClean, 'plus');
        playCleanCatch();
        updateHUD();

        if (state.bucketFill >= 100) {
          setTimeout(() => endGame(true), 300);
          return;
        }
      } else {
        // Dirty drop caught
        state.dirtyFill = Math.min(100, state.dirtyFill + CONFIG.dirtyPerDrop);
        showScorePop(px, py, 'Dirty!', 'minus');
        playDirtyCatch();
        screenFlash('bad');
        updateHUD();

        if (state.dirtyFill >= 100) {
          setTimeout(() => endGame(false), 300);
          return;
        }
      }

      setTimeout(() => removeDrop(drop), 300);
      continue;
    }

    // Drop fell past bottom
    if (drop.y > state.gameAreaH) {
      drop.el.classList.add('missed');
      setTimeout(() => removeDrop(drop), 300);
    }
  }

  // Move bucket if keys held
  const halfW = (CONFIG.bucketWidth / 2) / state.gameAreaW * 100;
  const pxPerPct = 100 / state.gameAreaW;
  const spd = CONFIG.bucketSpeed[state.difficulty] * dt * pxPerPct;

  if (keys.left  && state.bucketX > halfW)        setBucketX(state.bucketX - spd);
  if (keys.right && state.bucketX < 100 - halfW)  setBucketX(state.bucketX + spd);

  state.animFrame = requestAnimationFrame(gameLoop);
}

// ============================================================
//   HUD UPDATE
// ============================================================
function updateHUD() {
  dom.scoreDisplay.textContent = state.score;
  dom.timerDisplay.textContent = state.timeLeft;

  dom.bucketFillPct.textContent = Math.round(state.bucketFill) + '%';
  dom.dirtyPct.textContent      = Math.round(state.dirtyFill) + '%';

  dom.bucketFillBar.style.width = state.bucketFill + '%';
  dom.dirtyBar.style.width      = state.dirtyFill + '%';

  // Update liquid inside bucket visual
  dom.bucketLiquid.style.height = state.bucketFill + '%';

  // Turn liquid dirty if dirty fill is high
  const dirtyRatio = state.dirtyFill / 100;
  if (dirtyRatio > 0.5) {
    const r = Math.round(59 + (107 - 59) * ((dirtyRatio - 0.5) * 2));
    const g = Math.round(172 + (124 - 172) * ((dirtyRatio - 0.5) * 2));
    const b = Math.round(217 + (74  - 217) * ((dirtyRatio - 0.5) * 2));
    dom.bucketLiquid.style.background = `linear-gradient(180deg, rgba(${r},${g},${b},0.6) 0%, rgb(${r},${g},${b}) 100%)`;
  } else {
    dom.bucketLiquid.style.background = 'linear-gradient(180deg, rgba(91,200,232,0.6) 0%, #3BACD9 100%)';
  }
}

// ============================================================
//   SCREEN FLASH
// ============================================================
function screenFlash(type) {
  const el = document.createElement('div');
  el.className = 'flash ' + type;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 400);
}

// ============================================================
//   TIMER
// ============================================================
function startTimer() {
  state.timerInterval = setInterval(() => {
    if (!state.running) return;
    state.timeLeft--;
    updateHUD();

    if (state.timeLeft <= 0) {
      endGame(state.bucketFill >= 50);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// ============================================================
//   START / END GAME
// ============================================================
function startGame() {
  // Reset state
  state.score      = 0;
  state.bucketFill = 0;
  state.dirtyFill  = 0;
  state.timeLeft   = CONFIG.gameDuration;
  state.drops      = [];
  state.running    = true;
  state.lastTime   = null;
  state.bucketX    = 50;

  // Clear old drops
  dom.dropsContainer.innerHTML = '';

  // Show game screen
  showScreen('game');
  requestAnimationFrame(() => {
    measureGameArea();
    updateHUD();
    setBucketX(50);

    // Start loops
    state.animFrame = requestAnimationFrame(gameLoop);
    startTimer();
    spawnDrop();
  });
}

function endGame(won) {
  state.running = false;

  cancelAnimationFrame(state.animFrame);
  stopTimer();
  clearTimeout(state.spawnTimeout);

  // Remove all drops
  dom.dropsContainer.innerHTML = '';

  if (won) {
    playWin();
    dom.endIcon.textContent    = '🎉';
    dom.endTitle.textContent   = 'Amazing Job!';
    dom.endMessage.textContent = 'You filled the bucket with clean water!';
  } else {
    playGameOver();
    dom.endIcon.textContent    = '😔';
    dom.endTitle.textContent   = 'Game Over!';
    if (state.timeLeft <= 0) {
      dom.endMessage.textContent = "Time's up! Keep practicing to fill the bucket.";
    } else {
      dom.endMessage.textContent = 'Too much dirty water got in. Try again!';
    }
  }

  dom.endScore.textContent  = state.score;
  dom.endBucket.textContent = Math.round(state.bucketFill) + '%';
  dom.endDirty.textContent  = Math.round(state.dirtyFill) + '%';

  setTimeout(() => showScreen('end'), 400);
}

// ============================================================
//   KEYBOARD INPUT
// ============================================================
const keys = { left: false, right: false };

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === ' ' && state.screen === 'start') startGame();
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// ============================================================
//   TOUCH / BUTTON INPUT
// ============================================================
function holdButton(btn, key) {
  let interval = null;

  function start(e) {
    e.preventDefault();
    keys[key] = true;
    interval = setInterval(() => {}, 100);
    // Resume audio context on user gesture
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function stop(e) {
    e.preventDefault();
    keys[key] = false;
    clearInterval(interval);
  }

  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup',   stop);
  btn.addEventListener('pointerleave', stop);
}

holdButton($('btn-left'),  'left');
holdButton($('btn-right'), 'right');

// ============================================================
//   SOUND TOGGLE
// ============================================================
function applySoundToggle(on) {
  state.soundOn = on;
  const soundBtns = [$('btn-sound-game'), $('toggle-sound')];
  soundBtns.forEach(btn => {
    if (!btn) return;
    if (btn.id === 'btn-sound-game') btn.textContent = on ? '🔊' : '🔇';
    if (btn.id === 'toggle-sound') btn.classList.toggle('on', on);
  });
}

$('btn-sound-game').addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  applySoundToggle(!state.soundOn);
});

// ============================================================
//   OPTIONS
// ============================================================
function applyDifficulty(diff) {
  state.difficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === diff);
  });

  const durations = { easy: '90 sec', normal: '60 sec', hard: '45 sec' };
  const speeds    = { easy: 'Slow',   normal: 'Normal', hard: 'Fast' };

  // Update game duration for difficulty
  CONFIG.gameDuration = diff === 'easy' ? 90 : diff === 'hard' ? 45 : 60;

  $('opt-duration').textContent = durations[diff];
  $('opt-speed').textContent    = speeds[diff];
}

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => applyDifficulty(btn.dataset.diff));
});

$('toggle-sound').addEventListener('click', () => {
  const isOn = !$('toggle-sound').classList.contains('on');
  applySoundToggle(isOn);
});

// ============================================================
//   BUTTON NAVIGATION
// ============================================================
$('btn-start').addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  else getAudio();
  startGame();
});

$('btn-learn-more-start').addEventListener('click', () => showScreen('learn'));
$('btn-options-start').addEventListener('click',    () => showScreen('options'));
$('btn-back-learn').addEventListener('click',       () => showScreen('start'));
$('btn-back-options').addEventListener('click',     () => showScreen('start'));
$('btn-restart').addEventListener('click',          () => startGame());

// ============================================================
//   RESIZE HANDLER
// ============================================================
window.addEventListener('resize', () => {
  if (state.screen === 'game') measureGameArea();
});

// ============================================================
//   SWIPE SUPPORT (touch drag on game area)
// ============================================================
let touchStartX = null;

dom.gameArea.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

dom.gameArea.addEventListener('touchmove', e => {
  if (touchStartX === null) return;
  const dx = e.touches[0].clientX - touchStartX;
  touchStartX = e.touches[0].clientX;
  const pxToPct = 100 / state.gameAreaW;
  setBucketX(state.bucketX + dx * pxToPct * 1.5);
}, { passive: true });

dom.gameArea.addEventListener('touchend', () => {
  touchStartX = null;
}, { passive: true });

// ============================================================
//   INIT
// ============================================================
applyDifficulty('easy');
applySoundToggle(true);
