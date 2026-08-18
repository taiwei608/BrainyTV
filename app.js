const STORAGE_KEY = 'family-learning-tv-v1';

const defaultState = {
  players: [],
  currentPlayerId: null,
  settings: { duration: 60, mode: 'choice' }
};

let state = loadState();
let game = null;
let timerId = null;

const screens = {
  home: document.getElementById('homeScreen'),
  game: document.getElementById('gameScreen'),
  result: document.getElementById('resultScreen')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved, settings: { ...defaultState.settings, ...(saved.settings || {}) } } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentPlayer() {
  return state.players.find(p => p.id === state.currentPlayerId) || null;
}

function createPlayer(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const player = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: trimmed,
    highScore: 0,
    lastScore: null,
    plays: 0,
    questionStats: {}
  };
  state.players.push(player);
  state.currentPlayerId = player.id;
  saveState();
  renderHome();
}

function renderHome() {
  const list = document.getElementById('playerList');
  list.innerHTML = '';

  if (!state.players.length) {
    const empty = document.createElement('div');
    empty.className = 'player-option';
    empty.textContent = '先新增一位玩家';
    list.appendChild(empty);
  } else {
    state.players.forEach(player => {
      const btn = document.createElement('button');
      btn.className = 'player-option' + (player.id === state.currentPlayerId ? ' selected' : '');
      btn.dataset.playerId = player.id;
      const last = player.lastScore == null ? '尚未遊玩' : `最近 ${player.lastScore} 分`;
      btn.innerHTML = `${escapeHtml(player.name)}<small>最高 ${player.highScore} 分 · ${last}</small>`;
      btn.addEventListener('click', () => {
        state.currentPlayerId = player.id;
        saveState();
        renderHome();
        btn.focus();
      });
      list.appendChild(btn);
    });
  }

  const badge = document.getElementById('currentPlayerBadge');
  const player = currentPlayer();
  badge.textContent = player ? `玩家：${player.name}` : '尚未選擇玩家';

  document.querySelectorAll('[data-duration]').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.dataset.duration) === state.settings.duration);
  });
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === state.settings.mode);
  });
}

function showScreen(name) {
  Object.values(screens).forEach(el => el.classList.remove('active'));
  screens[name].classList.add('active');
  requestAnimationFrame(() => focusFirst(screens[name]));
}

function startGame() {
  const player = currentPlayer();
  if (!player) {
    document.getElementById('playerDialog').showModal();
    setTimeout(() => document.getElementById('playerName').focus(), 50);
    return;
  }

  game = {
    playerId: player.id,
    score: 0,
    correct: 0,
    wrong: 0,
    questionNumber: 0,
    timeLeft: state.settings.duration,
    answered: false,
    input: '',
    current: null
  };

  document.getElementById('hudPlayer').textContent = player.name;
  updateHud();
  showScreen('game');
  nextQuestion();

  clearInterval(timerId);
  timerId = setInterval(() => {
    game.timeLeft -= 1;
    updateHud();
    if (game.timeLeft <= 0) finishGame();
  }, 1000);
}

function nextQuestion() {
  if (!game || game.timeLeft <= 0) return finishGame();
  game.answered = false;
  game.input = '';
  game.questionNumber += 1;
  game.current = generateQuestion(currentPlayer());

  document.getElementById('questionMeta').textContent = `第 ${game.questionNumber} 題`;
  document.getElementById('questionText').textContent = `${game.current.a} × ${game.current.b} = ?`;
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  if (state.settings.mode === 'choice') renderChoices();
  else renderKeypad();
}

function generateQuestion(player) {
  const candidates = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const key = `${a}x${b}`;
      const stats = player.questionStats[key] || { correct: 0, wrong: 0 };
      const weight = 1 + stats.wrong * 2 - Math.min(stats.correct, 3) * 0.15;
      candidates.push({ a, b, key, weight: Math.max(.5, weight) });
    }
  }
  const total = candidates.reduce((sum, q) => sum + q.weight, 0);
  let pick = Math.random() * total;
  for (const q of candidates) {
    pick -= q.weight;
    if (pick <= 0) return { ...q, answer: q.a * q.b };
  }
  const q = candidates[candidates.length - 1];
  return { ...q, answer: q.a * q.b };
}

function renderChoices() {
  document.getElementById('choiceArea').classList.remove('hidden');
  document.getElementById('keypadArea').classList.add('hidden');
  const area = document.getElementById('choiceArea');
  area.innerHTML = '';
  makeChoiceOptions(game.current.answer).forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = value;
    btn.dataset.answerValue = String(value);
    btn.addEventListener('click', () => submitAnswer(value, btn));
    area.appendChild(btn);
  });
  requestAnimationFrame(() => focusFirst(area));
}

function makeChoiceOptions(answer) {
  const values = new Set([answer]);
  const offsets = [-10,-9,-8,-7,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7,8,9,10];
  while (values.size < 4) {
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    const candidate = answer + offset;
    if (candidate >= 1 && candidate <= 81) values.add(candidate);
  }
  return shuffle([...values]);
}

function renderKeypad() {
  document.getElementById('choiceArea').classList.add('hidden');
  document.getElementById('keypadArea').classList.remove('hidden');
  const grid = document.getElementById('keypadGrid');
  grid.innerHTML = '';
  [...Array(10).keys()].forEach(num => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = num;
    btn.addEventListener('click', () => appendDigit(num));
    grid.appendChild(btn);
  });
  const erase = document.createElement('button');
  erase.className = 'key-btn'; erase.textContent = '⌫'; erase.addEventListener('click', eraseDigit);
  const ok = document.createElement('button');
  ok.className = 'key-btn'; ok.textContent = '確認'; ok.addEventListener('click', () => {
    if (game.input) submitAnswer(Number(game.input), ok);
  });
  grid.append(erase, ok);
  updateKeypadDisplay();
  requestAnimationFrame(() => focusFirst(grid));
}

function appendDigit(num) {
  if (game.answered || game.input.length >= 2) return;
  game.input += String(num);
  updateKeypadDisplay();
}
function eraseDigit() {
  if (game.answered) return;
  game.input = game.input.slice(0,-1);
  updateKeypadDisplay();
}
function updateKeypadDisplay() {
  document.getElementById('keypadDisplay').textContent = game.input || '_';
}

function submitAnswer(value, sourceButton) {
  if (!game || game.answered) return;
  game.answered = true;
  const correct = value === game.current.answer;
  const player = currentPlayer();
  const stats = player.questionStats[game.current.key] || { correct: 0, wrong: 0 };

  if (correct) {
    game.score += 10;
    game.correct += 1;
    stats.correct += 1;
  } else {
    game.wrong += 1;
    stats.wrong += 1;
  }
  player.questionStats[game.current.key] = stats;
  saveState();
  updateHud();

  const feedback = document.getElementById('feedback');
  feedback.textContent = correct ? `答對了！答案是 ${game.current.answer}` : `答案是 ${game.current.answer}`;
  feedback.className = `feedback ${correct ? 'good' : 'bad'}`;

  if (state.settings.mode === 'choice') {
    document.querySelectorAll('.answer-btn').forEach(btn => {
      const v = Number(btn.dataset.answerValue);
      if (v === game.current.answer) btn.classList.add('correct');
      else if (btn === sourceButton) btn.classList.add('wrong');
    });
  }
}

function updateHud() {
  if (!game) return;
  document.getElementById('scoreText').textContent = game.score;
  document.getElementById('timeText').textContent = game.timeLeft;
}

function finishGame() {
  if (!game) return;
  clearInterval(timerId);
  timerId = null;
  const player = currentPlayer();
  player.lastScore = game.score;
  player.highScore = Math.max(player.highScore || 0, game.score);
  player.plays = (player.plays || 0) + 1;
  saveState();

  const total = game.correct + game.wrong;
  const accuracy = total ? Math.round((game.correct / total) * 100) : 0;
  document.getElementById('resultTitle').textContent = `${player.name}，完成！`;
  document.getElementById('finalScore').textContent = game.score;
  document.getElementById('correctCount').textContent = game.correct;
  document.getElementById('wrongCount').textContent = game.wrong;
  document.getElementById('accuracyText').textContent = `${accuracy}%`;
  document.getElementById('highScoreText').textContent = player.highScore;
  showScreen('result');
}

function renderManagePlayers() {
  const root = document.getElementById('managePlayerList');
  root.innerHTML = '';
  state.players.forEach(player => {
    const row = document.createElement('div');
    row.className = 'manage-row';
    const info = document.createElement('div');
    info.innerHTML = `<strong>${escapeHtml(player.name)}</strong><br><small>最高 ${player.highScore} 分 · 遊玩 ${player.plays || 0} 次</small>`;
    const actions = document.createElement('div');
    actions.className = 'manage-actions';
    const clear = document.createElement('button');
    clear.className = 'btn secondary'; clear.textContent = '清除紀錄';
    clear.addEventListener('click', () => {
      player.highScore = 0; player.lastScore = null; player.plays = 0; player.questionStats = {};
      saveState(); renderManagePlayers(); renderHome();
    });
    const del = document.createElement('button');
    del.className = 'btn danger'; del.textContent = '刪除';
    del.addEventListener('click', () => {
      state.players = state.players.filter(p => p.id !== player.id);
      if (state.currentPlayerId === player.id) state.currentPlayerId = state.players[0]?.id || null;
      saveState(); renderManagePlayers(); renderHome();
    });
    actions.append(clear, del);
    row.append(info, actions);
    root.appendChild(row);
  });
}

function focusable(root = document) {
  return [...root.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.closest('.hidden') && el.offsetParent !== null);
}

function focusFirst(root = document) {
  const el = focusable(root)[0];
  if (el) el.focus();
}

function moveFocus(direction) {
  const items = focusable(document);
  const current = document.activeElement;
  if (!items.includes(current)) return focusFirst();
  const rect = current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const candidates = items.filter(el => el !== current).map(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const valid = direction === 'left' ? dx < -8 : direction === 'right' ? dx > 8 : direction === 'up' ? dy < -8 : dy > 8;
    if (!valid) return null;
    const primary = (direction === 'left' || direction === 'right') ? Math.abs(dx) : Math.abs(dy);
    const cross = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);
    return { el, score: primary + cross * 2.4 };
  }).filter(Boolean).sort((a,b) => a.score - b.score);

  if (candidates[0]) candidates[0].el.focus();
}

function remoteKey(event) {
  const key = event.key;
  const code = event.keyCode || event.which;
  const directions = {
    ArrowLeft: 'left', Left: 'left',
    ArrowRight: 'right', Right: 'right',
    ArrowUp: 'up', Up: 'up',
    ArrowDown: 'down', Down: 'down'
  };

  if (directions[key]) return directions[key];

  // Android KeyEvent codes used by some TV WebViews and remote controls.
  if (code === 21 || code === 37) return 'left';
  if (code === 22 || code === 39) return 'right';
  if (code === 19 || code === 38) return 'up';
  if (code === 20 || code === 40) return 'down';
  if (key === 'Enter' || key === 'Accept' || key === 'Select' || key === ' ' || code === 13 || code === 23 || code === 66) return 'ok';
  if (key === 'Escape' || key === 'BrowserBack' || key === 'GoBack' || code === 4 || code === 27) return 'back';
  return null;
}

function handleRemoteKey(event) {
  const action = remoteKey(event);

  if (['left', 'right', 'up', 'down'].includes(action)) {
    event.preventDefault();
    event.stopPropagation();
    moveFocus(action);
    return;
  }

  if (action === 'ok') {
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (game?.answered && screens.game.classList.contains('active')) nextQuestion();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.click();
    return;
  }

  if (action === 'back' && screens.game.classList.contains('active')) {
    event.preventDefault();
    event.stopPropagation();
    clearInterval(timerId);
    timerId = null;
    game = null;
    showScreen('home');
  }
}

// Capture first so compatible TV browsers cannot scroll the page before the
// app handles a D-pad event.
window.addEventListener('keydown', handleRemoteKey, { capture: true });
window.addEventListener('keyup', event => {
  if (remoteKey(event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, { capture: true });

// In TV Bro cursor mode, keep the visible focus ring aligned with the item
// under the cursor. Direct navigation mode remains the recommended option.
document.addEventListener('pointermove', event => {
  const target = event.target.closest?.('button:not([disabled]), input:not([disabled])');
  if (target && target !== document.activeElement) target.focus({ preventScroll: true });
}, { passive: true });

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'add-player') {
    document.getElementById('playerName').value = '';
    document.getElementById('playerDialog').showModal();
    setTimeout(() => document.getElementById('playerName').focus(), 50);
  }
  if (action === 'manage-player') {
    renderManagePlayers();
    document.getElementById('manageDialog').showModal();
  }
  if (action === 'close-manage') document.getElementById('manageDialog').close();
  if (action === 'play-again') startGame();
  if (action === 'back-home') { game = null; renderHome(); showScreen('home'); }

  const duration = event.target.closest('[data-duration]')?.dataset.duration;
  if (duration) { state.settings.duration = Number(duration); saveState(); renderHome(); }
  const mode = event.target.closest('[data-mode]')?.dataset.mode;
  if (mode) { state.settings.mode = mode; saveState(); renderHome(); }
  if (event.target.closest('[data-game="multiplication"]')) startGame();
});

document.getElementById('playerForm').addEventListener('submit', event => {
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const input = document.getElementById('playerName');
  createPlayer(input.value);
  document.getElementById('playerDialog').close();
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

renderHome();
focusFirst();
