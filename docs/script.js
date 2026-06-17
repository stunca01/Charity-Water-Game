/* =========================================================
   FILL THE BUCKET - SIMPLE GAME LOGIC
   HTML = structure
   CSS = design
   JS = behavior
   ========================================================= */


/* =========================================================
   1. CONNECT HTML ELEMENTS TO JAVASCRIPT
   ========================================================= */

const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

const leftBtn = document.getElementById("left-btn");
const rightBtn = document.getElementById("right-btn");

const howBtn = document.getElementById("how-btn");
const optionsBtn = document.getElementById("options-btn");

const howModal = document.getElementById("how-modal");
const optionsModal = document.getElementById("options-modal");

const closeHowBtn = document.getElementById("close-how-btn");
const closeOptionsBtn = document.getElementById("close-options-btn");
const toggleSoundBtn = document.getElementById("toggle-sound-btn");
const soundStatus = document.getElementById("sound-status");

const timeText = document.getElementById("time-text");
const scoreText = document.getElementById("score-text");
const bucketPercentText = document.getElementById("bucket-percent");
const dirtyPercentText = document.getElementById("dirty-percent");

const bucketFillBar = document.getElementById("bucket-fill-bar");
const dirtyFillBar = document.getElementById("dirty-fill-bar");

const dropsLayer = document.getElementById("drops-layer");
const bucket = document.getElementById("bucket");
const gameArea = document.querySelector(".game-area");

const endTitle = document.getElementById("end-title");
const endHeading = document.getElementById("end-heading");
const endMessage = document.getElementById("end-message");

const finalScore = document.getElementById("final-score");
const finalBucket = document.getElementById("final-bucket");
const finalDirty = document.getElementById("final-dirty");


/* =========================================================
   2. GAME SETTINGS
   Change these values to adjust the game.
   ========================================================= */

const GAME_TIME = 59;

const CLEAN_SCORE_AMOUNT = 10;
const CLEAN_FILL_AMOUNT = 10;
const DIRTY_AMOUNT = 15;

const BUCKET_SPEED = 32;
const DROP_SPEED = 3.2;
const DROP_SPAWN_RATE = 900;


/* =========================================================
   3. GAME STATE
   These values change during the game.
   ========================================================= */

let timeLeft = GAME_TIME;
let score = 0;
let bucketFill = 0;
let dirtyWater = 0;

let bucketX = 195;

let gameRunning = false;
let soundOn = true;

let timerInterval = null;
let dropInterval = null;
let animationFrameId = null;


/* =========================================================
   4. SCREEN SWITCHING
   ========================================================= */

function showScreen(screen) {
  startScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  endScreen.classList.remove("active");

  screen.classList.add("active");
}


/* =========================================================
   5. RESET GAME
   ========================================================= */

function resetGame() {
  timeLeft = GAME_TIME;
  score = 0;
  bucketFill = 0;
  dirtyWater = 0;
  bucketX = 195;

  dropsLayer.innerHTML = "";

  updateHUD();
  updateBucketPosition();
}


/* =========================================================
   6. UPDATE TEXT AND BARS
   ========================================================= */

function updateHUD() {
  timeText.textContent = timeLeft;
  scoreText.textContent = score;

  bucketPercentText.textContent = `${bucketFill}%`;
  dirtyPercentText.textContent = `${dirtyWater}%`;

  bucketFillBar.style.width = `${bucketFill}%`;
  dirtyFillBar.style.width = `${dirtyWater}%`;
}


/* =========================================================
   7. BUCKET MOVEMENT
   ========================================================= */

function updateBucketPosition() {
  bucket.style.left = `${bucketX}px`;
}

function moveBucketLeft() {
  if (!gameRunning) return;

  bucketX -= BUCKET_SPEED;

  if (bucketX < 60) {
    bucketX = 60;
  }

  updateBucketPosition();
}

function moveBucketRight() {
  if (!gameRunning) return;

  bucketX += BUCKET_SPEED;

  if (bucketX > 330) {
    bucketX = 330;
  }

  updateBucketPosition();
}


/* =========================================================
   8. CREATE A FALLING DROP
   ========================================================= */

function createDrop() {
  if (!gameRunning) return;

  const drop = document.createElement("div");

  const isDirty = Math.random() < 0.35;

  drop.classList.add("falling-drop");

  if (isDirty) {
    drop.classList.add("dirty");
    drop.dataset.type = "dirty";
    // drop.textContent = "☣️";
    drop.innerHTML = '<img src="assets/contaminated-water.png" alt="Dirty water">';
  } else {
    drop.classList.add("clean");
    drop.dataset.type = "clean";
    //drop.textContent = "💧";
    drop.innerHTML = '<img src="assets/water.png" alt="Clean water">';
  }

  const gameAreaWidth = gameArea.clientWidth;

  const randomX = Math.floor(Math.random() * (gameAreaWidth - 80)) + 30;

  drop.style.left = `${randomX}px`;
  drop.style.top = `80px`;

  dropsLayer.appendChild(drop);
}


/* =========================================================
   9. MOVE DROPS DOWN
   ========================================================= */

function moveDrops() {
  if (!gameRunning) return;

  const drops = document.querySelectorAll(".falling-drop");

  drops.forEach((drop) => {
    const currentTop = Number(drop.style.top.replace("px", ""));
    const newTop = currentTop + DROP_SPEED;

    drop.style.top = `${newTop}px`;

    if (isTouching(drop, bucket)) {
      catchDrop(drop);
      drop.remove();
    }

    if (newTop > gameArea.clientHeight - 40) {
      drop.remove();
    }
  });

  animationFrameId = requestAnimationFrame(moveDrops);
}


/* =========================================================
   10. COLLISION DETECTION
   Checks if the drop touches the bucket.
   ========================================================= */

function isTouching(drop, bucket) {
  const dropBox = drop.getBoundingClientRect();
  const bucketBox = bucket.getBoundingClientRect();

  return !(
    dropBox.bottom < bucketBox.top ||
    dropBox.top > bucketBox.bottom ||
    dropBox.right < bucketBox.left ||
    dropBox.left > bucketBox.right
  );
}


/* =========================================================
   11. WHEN PLAYER CATCHES A DROP
   ========================================================= */

function catchDrop(drop) {
  if (drop.dataset.type === "clean") {
    score += CLEAN_SCORE_AMOUNT;
    bucketFill += CLEAN_FILL_AMOUNT;

    if (bucketFill > 100) {
      bucketFill = 100;
    }
  }

  if (drop.dataset.type === "dirty") {
    dirtyWater += DIRTY_AMOUNT;

    if (dirtyWater > 100) {
      dirtyWater = 100;
    }
  }

  updateHUD();
  checkEndConditions();
}


/* =========================================================
   12. TIMER
   ========================================================= */

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft -= 1;

    if (timeLeft < 0) {
      timeLeft = 0;
    }

    updateHUD();
    checkEndConditions();
  }, 1000);
}


/* =========================================================
   13. START GAME
   ========================================================= */

function startGame() {
  clearInterval(timerInterval);
  clearInterval(dropInterval);
  cancelAnimationFrame(animationFrameId);

  resetGame();

  gameRunning = true;
  showScreen(gameScreen);

  startTimer();
  dropInterval = setInterval(createDrop, DROP_SPAWN_RATE);
  animationFrameId = requestAnimationFrame(moveDrops);
}


/* =========================================================
   14. END GAME
   ========================================================= */

function checkEndConditions() {
  if (!gameRunning) return;

  if (bucketFill >= 100) {
    endGame("success");
  } else if (dirtyWater >= 100) {
    endGame("dirty");
  } else if (timeLeft <= 0) {
    endGame("time");
  }
}

function endGame(reason) {
  gameRunning = false;

  clearInterval(timerInterval);
  clearInterval(dropInterval);
  cancelAnimationFrame(animationFrameId);

  dropsLayer.innerHTML = "";

  if (reason === "success") {
    endTitle.textContent = "Great Job!";
    endHeading.textContent = "Bucket Filled!";
    endMessage.textContent = "You collected enough clean water!";
  } else if (reason === "dirty") {
    endTitle.textContent = "Game Over!";
    endHeading.textContent = "Too Much Dirty Water!";
    endMessage.textContent = "Try again and avoid the dirty drops.";
  } else {
    endTitle.textContent = "Time's Up!";
    endHeading.textContent = "Good Try!";
    endMessage.textContent = "Keep playing to collect more clean water.";
  }

  finalScore.textContent = score;
  finalBucket.textContent = `${bucketFill}%`;
  finalDirty.textContent = `${dirtyWater}%`;

  showScreen(endScreen);
}


/* =========================================================
   15. MODALS
   ========================================================= */

function openHowModal() {
  howModal.classList.remove("hidden");
}

function closeHowModal() {
  howModal.classList.add("hidden");
}

function openOptionsModal() {
  optionsModal.classList.remove("hidden");
}

function closeOptionsModal() {
  optionsModal.classList.add("hidden");
}

function toggleSound() {
  soundOn = !soundOn;
  soundStatus.textContent = soundOn ? "On" : "Off";
}


/* =========================================================
   16. BUTTON CLICKS
   ========================================================= */

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

leftBtn.addEventListener("click", moveBucketLeft);
rightBtn.addEventListener("click", moveBucketRight);

howBtn.addEventListener("click", openHowModal);
optionsBtn.addEventListener("click", openOptionsModal);

closeHowBtn.addEventListener("click", closeHowModal);
closeOptionsBtn.addEventListener("click", closeOptionsModal);
toggleSoundBtn.addEventListener("click", toggleSound);


/* =========================================================
   17. KEYBOARD CONTROLS
   ========================================================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    moveBucketLeft();
  }

  if (event.key === "ArrowRight") {
    moveBucketRight();
  }
});


/* =========================================================
   18. FIRST LOAD
   Make sure the game opens on the start screen.
   ========================================================= */

resetGame();
showScreen(startScreen);