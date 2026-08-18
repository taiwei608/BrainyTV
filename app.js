const STORAGE_KEY = 'family-learning-tv-v1';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const GAME_DEFINITIONS = {
  multiplication: { label: '九九乘法', symbol: '×', levels: ['all'] },
  addition: { label: '加法挑戰', symbol: '+', levels: ['ones', 'tens', 'hundreds'] },
  subtraction: { label: '減法挑戰', symbol: '−', levels: ['ones', 'tens', 'hundreds'] }
};

const LEVEL_DEFINITIONS = {
  all: { label: '九九乘法', min: 2, max: 9 },
  ones: { label: '個位數', min: 1, max: 9 },
  tens: { label: '十位數', min: 10, max: 99 },
  hundreds: { label: '百位數', min: 100, max: 999 }
};

const defaultState = {
  players: [],
  currentPlayerId: null,
  settings: { duration: 60, mode: 'choice', gameType: 'multiplication', level: 'ones' }
};

let state = loadState();
let game = null;
let timerId = null;
let pendingPlayerAction = null;

const screens = {
  players: document.getElementById('playerScreen'),
  games: document.getElementById('gamesScreen'),
  settings: document.getElementById('settingsScreen'),
  manage: document.getElementById('manageScreen'),
  game: document.getElementById('gameScreen'),
  result: document.getElementById('resultScreen')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const loaded = saved ? { ...defaultState, ...saved, settings: { ...defaultState.settings, ...(saved.settings || {}) } } : cloneData(defaultState);
    loaded.settings.duration = 60;
    if (!GAME_DEFINITIONS[loaded.settings.gameType]) loaded.settings.gameType = 'multiplication';
    if (!LEVEL_DEFINITIONS[loaded.settings.level]) loaded.settings.level = 'ones';
    loaded.players = Array.isArray(loaded.players) ? loaded.players : [];
    loaded.players.forEach(ensurePlayerProgress);
    return loaded;
  } catch {
    return cloneData(defaultState);
  }
}

function saveState() {
  state.players.forEach(ensurePlayerProgress);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneData(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function emptyRecord() {
  return { highScore: 0, lastScore: null, plays: 0, questionStats: {} };
}

function createProgressMap() {
  return {
    multiplication: { all: emptyRecord() },
    addition: { ones: emptyRecord(), tens: emptyRecord(), hundreds: emptyRecord() },
    subtraction: { ones: emptyRecord(), tens: emptyRecord(), hundreds: emptyRecord() }
  };
}

function ensurePlayerProgress(player) {
  if (!player.progress || typeof player.progress !== 'object') player.progress = {};

  Object.entries(GAME_DEFINITIONS).forEach(([gameType, definition]) => {
    if (!player.progress[gameType] || typeof player.progress[gameType] !== 'object') {
      player.progress[gameType] = {};
    }
    definition.levels.forEach(level => {
      if (!player.progress[gameType][level]) {
        const isLegacyMultiplication = gameType === 'multiplication' && level === 'all';
        player.progress[gameType][level] = isLegacyMultiplication
          ? {
              highScore: Number(player.highScore) || 0,
              lastScore: player.lastScore ?? null,
              plays: Number(player.plays) || 0,
              questionStats: player.questionStats && typeof player.questionStats === 'object' ? player.questionStats : {}
            }
          : emptyRecord();
      }
      const record = player.progress[gameType][level];
      record.highScore = Number(record.highScore) || 0;
      record.lastScore = record.lastScore == null ? null : Number(record.lastScore) || 0;
      record.plays = Number(record.plays) || 0;
      if (!record.questionStats || typeof record.questionStats !== 'object') record.questionStats = {};
    });
  });

  return player;
}

function playerRecord(player, gameType = state.settings.gameType, level = selectedLevel(gameType)) {
  ensurePlayerProgress(player);
  return player.progress[gameType][level];
}

function selectedLevel(gameType = state.settings.gameType) {
  return gameType === 'multiplication' ? 'all' : state.settings.level;
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
    questionStats: {},
    progress: createProgressMap()
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
      btn.innerHTML = `${escapeHtml(player.name)}<small>${player.id === state.currentPlayerId ? '目前玩家' : '按 OK 選擇'}</small>`;
      btn.addEventListener('click', () => {
        state.currentPlayerId = player.id;
        saveState();
        renderHome();
        requestAnimationFrame(() => {
          const selected = document.querySelector(`[data-player-id="${player.id}"]`);
          if (selected) focusWithoutScroll(selected);
        });
      });
      list.appendChild(btn);
    });
  }

  const badge = document.getElementById('currentPlayerBadge');
  const player = currentPlayer();
  badge.textContent = player ? `玩家：${player.name}` : '尚未選擇玩家';
  document.querySelectorAll('.selected-player-badge').forEach(el => {
    el.textContent = player ? `玩家：${player.name}` : '尚未選擇玩家';
  });
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === state.settings.mode);
  });
}

function selectGame(gameType) {
  if (!GAME_DEFINITIONS[gameType]) return;
  state.settings.gameType = gameType;
  if (gameType !== 'multiplication' && !['ones', 'tens', 'hundreds'].includes(state.settings.level)) {
    state.settings.level = 'ones';
  }
  saveState();
  renderSettings();
  showScreen('settings');
}

function renderSettings() {
  const gameType = state.settings.gameType;
  const definition = GAME_DEFINITIONS[gameType];
  const player = currentPlayer();
  document.getElementById('settingsTitle').textContent = `${definition.label}設定`;
  document.getElementById('levelSetting').classList.toggle('hidden', gameType === 'multiplication');

  document.querySelectorAll('[data-level]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.level === state.settings.level);
  });
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === state.settings.mode);
  });

  const title = document.getElementById('scoreboardTitle');
  title.textContent = player ? `${player.name}・${definition.label}` : definition.label;
  renderScoreboardRows(player, gameType);
}

function renderScoreboardRows(player, gameType) {
  const root = document.getElementById('scoreboardRows');
  root.innerHTML = '';
  if (!player) return;

  GAME_DEFINITIONS[gameType].levels.forEach(level => {
    const record = playerRecord(player, gameType, level);
    const row = document.createElement('div');
    row.className = 'scoreboard-row' + (level === selectedLevel(gameType) ? ' selected' : '');
    const lastScore = record.lastScore == null ? '—' : `${record.lastScore} 分`;
    row.innerHTML = `
      <strong>${LEVEL_DEFINITIONS[level].label}</strong>
      <span>最高 <b>${record.highScore} 分</b></span>
      <span>最近 <b>${lastScore}</b></span>
      <span>玩過 <b>${record.plays} 次</b></span>
    `;
    root.appendChild(row);
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
    gameType: state.settings.gameType,
    level: selectedLevel(),
    score: 0,
    correct: 0,
    wrong: 0,
    questionNumber: 0,
    timeLeft: state.settings.duration,
    answered: false,
    paused: false,
    finishAfterFeedback: false,
    answerUnlockAt: 0,
    input: '',
    current: null
  };

  document.getElementById('hudPlayer').textContent = player.name;
  updateHud();
  showScreen('game');
  nextQuestion();

  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!game || game.answered || game.paused) return;
    game.timeLeft = Math.max(0, game.timeLeft - 1);
    updateHud();
    if (game.timeLeft <= 0) finishGame();
  }, 1000);
}

function nextQuestion() {
  if (!game || game.timeLeft <= 0) return finishGame();
  game.answered = false;
  game.finishAfterFeedback = false;
  game.answerUnlockAt = Date.now() + 300;
  game.input = '';
  game.questionNumber += 1;
  game.current = generateQuestion(playerRecord(currentPlayer(), game.gameType, game.level), game.gameType, game.level);

  document.getElementById('questionMeta').textContent = `${GAME_DEFINITIONS[game.gameType].label}・${LEVEL_DEFINITIONS[game.level].label}・第 ${game.questionNumber} 題`;
  document.getElementById('questionText').textContent = `${game.current.a} ${game.current.operator} ${game.current.b} = ?`;
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('remoteHint').textContent = '方向鍵選擇答案・OK 確認';
  screens.game.classList.remove('wrong-feedback');
  document.querySelector('.countdown').classList.remove('time-penalty');

  if (state.settings.mode === 'choice') renderChoices();
  else renderKeypad();
}

function generateQuestion(record, gameType, level) {
  if (gameType !== 'multiplication') return generateArithmeticQuestion(record, gameType, level);

  const candidates = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const key = `${a}x${b}`;
      const stats = record.questionStats[key] || { correct: 0, wrong: 0 };
      const weight = questionWeight(stats);
      candidates.push({ a, b, key, weight: Math.max(.5, weight) });
    }
  }
  const total = candidates.reduce((sum, q) => sum + q.weight, 0);
  let pick = Math.random() * total;
  for (const q of candidates) {
    pick -= q.weight;
    if (pick <= 0) return { ...q, operator: '×', answer: q.a * q.b };
  }
  const q = candidates[candidates.length - 1];
  return { ...q, operator: '×', answer: q.a * q.b };
}

function generateArithmeticQuestion(record, gameType, level) {
  const { min, max } = LEVEL_DEFINITIONS[level];
  const candidates = new Map();

  Object.entries(record.questionStats)
    .filter(([, stats]) => (stats.wrong || 0) > 0)
    .sort(([, a], [, b]) => (b.wrong || 0) - (a.wrong || 0))
    .slice(0, 12)
    .forEach(([key, stats]) => {
      const parsed = parseArithmeticKey(key, gameType);
      if (parsed && parsed.a >= min && parsed.a <= max && parsed.b >= min && parsed.b <= max) {
        candidates.set(key, { ...parsed, key, weight: questionWeight(stats) + 2 });
      }
    });

  while (candidates.size < 42) {
    let a = randomInteger(min, max);
    let b = randomInteger(min, max);
    if (gameType === 'subtraction' && b > a) [a, b] = [b, a];
    const operator = gameType === 'addition' ? '+' : '−';
    const key = `${a}${operator}${b}`;
    const stats = record.questionStats[key] || { correct: 0, wrong: 0 };
    candidates.set(key, { a, b, operator, key, weight: questionWeight(stats) });
  }

  const list = [...candidates.values()];
  const total = list.reduce((sum, question) => sum + question.weight, 0);
  let pick = Math.random() * total;
  for (const question of list) {
    pick -= question.weight;
    if (pick <= 0) return { ...question, answer: calculateAnswer(question, gameType) };
  }
  const question = list[list.length - 1];
  return { ...question, answer: calculateAnswer(question, gameType) };
}

function questionWeight(stats) {
  return Math.max(.5, 1 + (stats.wrong || 0) * 2 - Math.min(stats.correct || 0, 3) * .15);
}

function parseArithmeticKey(key, gameType) {
  const separator = gameType === 'addition' ? '+' : '−';
  const parts = key.split(separator).map(Number);
  if (parts.length !== 2 || parts.some(value => !Number.isFinite(value))) return null;
  return { a: parts[0], b: parts[1], operator: separator };
}

function calculateAnswer(question, gameType) {
  return gameType === 'addition' ? question.a + question.b : question.a - question.b;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderChoices() {
  document.getElementById('choiceArea').classList.remove('hidden');
  document.getElementById('keypadArea').classList.add('hidden');
  const area = document.getElementById('choiceArea');
  area.innerHTML = '';
  makeChoiceOptions(game.current).forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = value;
    btn.dataset.answerValue = String(value);
    btn.addEventListener('click', () => submitAnswer(value, btn));
    area.appendChild(btn);
  });
  requestAnimationFrame(() => focusFirst(area));
}

function makeChoiceOptions(question) {
  const answer = question.answer;
  const values = new Set([answer]);
  const place = answer >= 1000 ? 100 : answer >= 100 ? 10 : answer >= 20 ? 5 : 1;
  const offsets = [-place * 2, -place, -10, -5, -2, -1, 1, 2, 5, 10, place, place * 2]
    .filter(offset => offset !== 0);
  while (values.size < 4) {
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    const candidate = answer + offset;
    if (candidate >= 0) values.add(candidate);
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
  const maxLength = Math.max(1, String(game.current.answer).length);
  if (game.answered || game.input.length >= maxLength) return;
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
  if (Date.now() < game.answerUnlockAt) return;
  game.answered = true;
  const correct = value === game.current.answer;
  const player = currentPlayer();
  const record = playerRecord(player, game.gameType, game.level);
  const stats = record.questionStats[game.current.key] || { correct: 0, wrong: 0 };

  if (correct) {
    game.score += 10;
    game.correct += 1;
    stats.correct += 1;
  } else {
    game.wrong += 1;
    stats.wrong += 1;
    game.timeLeft = Math.max(0, game.timeLeft - 5);
    game.finishAfterFeedback = game.timeLeft <= 0;
  }
  record.questionStats[game.current.key] = stats;
  saveState();
  updateHud();

  const feedback = document.getElementById('feedback');
  feedback.textContent = correct ? `答對了！答案是 ${game.current.answer}` : `答錯了！正確答案是 ${game.current.answer}，扣 5 秒`;
  feedback.className = `feedback ${correct ? 'good' : 'bad'}`;

  if (!correct) {
    const countdown = document.querySelector('.countdown');
    screens.game.classList.remove('wrong-feedback');
    countdown.classList.remove('time-penalty');
    void screens.game.offsetWidth;
    screens.game.classList.add('wrong-feedback');
    countdown.classList.add('time-penalty');
    setTimeout(() => {
      screens.game.classList.remove('wrong-feedback');
      countdown.classList.remove('time-penalty');
    }, 1600);
  }

  if (state.settings.mode === 'choice') {
    document.querySelectorAll('.answer-btn').forEach(btn => {
      const v = Number(btn.dataset.answerValue);
      if (v === game.current.answer) btn.classList.add('correct');
      else if (btn === sourceButton) btn.classList.add('wrong');
    });
  }

  document.getElementById('remoteHint').textContent = '按 OK 進入下一題';

}

function advanceAfterFeedback() {
  if (!game?.answered) return;
  if (game.finishAfterFeedback || game.timeLeft <= 0) finishGame();
  else nextQuestion();
}

function updateHud() {
  if (!game) return;
  document.getElementById('scoreText').textContent = game.score;
  document.getElementById('timeText').textContent = game.timeLeft;
  const progress = document.getElementById('timerProgress');
  const ratio = Math.max(0, game.timeLeft / 60);
  progress.style.width = `${ratio * 100}%`;
  progress.classList.toggle('urgent', game.timeLeft <= 10);
}

function finishGame() {
  if (!game) return;
  clearInterval(timerId);
  timerId = null;
  const player = currentPlayer();
  const record = playerRecord(player, game.gameType, game.level);
  record.lastScore = game.score;
  record.highScore = Math.max(record.highScore || 0, game.score);
  record.plays = (record.plays || 0) + 1;
  saveState();

  const total = game.correct + game.wrong;
  const accuracy = total ? Math.round((game.correct / total) * 100) : 0;
  document.getElementById('resultTitle').textContent = `${player.name}，完成！`;
  document.getElementById('finalScore').textContent = game.score;
  document.getElementById('correctCount').textContent = game.correct;
  document.getElementById('wrongCount').textContent = game.wrong;
  document.getElementById('accuracyText').textContent = `${accuracy}%`;
  document.getElementById('highScoreLabel').textContent = game.gameType === 'multiplication' ? '本遊戲最高' : '本級最高';
  document.getElementById('highScoreText').textContent = record.highScore;
  showScreen('result');
}

function exitGame() {
  clearInterval(timerId);
  timerId = null;
  game = null;
  renderHome();
  showScreen('players');
}

function openExitConfirmation() {
  const dialog = document.getElementById('exitDialog');
  if (dialog.open) return;
  if (game) game.paused = true;
  dialog.showModal();
  requestAnimationFrame(() => focusFirst(dialog));
}

function closeExitConfirmation() {
  const dialog = document.getElementById('exitDialog');
  if (dialog.open) dialog.close();
  if (game) game.paused = false;
  requestAnimationFrame(() => {
    const area = state.settings.mode === 'choice'
      ? document.getElementById('choiceArea')
      : document.getElementById('keypadGrid');
    focusFirst(area);
  });
}

function renderManagePlayers() {
  const root = document.getElementById('managePlayerList');
  pendingPlayerAction = null;
  root.classList.remove('hidden');
  document.getElementById('manageConfirmation').classList.add('hidden');
  document.getElementById('manageDoneActions').classList.remove('hidden');
  root.innerHTML = '';
  state.players.forEach(player => {
    const row = document.createElement('div');
    row.className = 'manage-row';
    const info = document.createElement('div');
    info.innerHTML = `<strong>${escapeHtml(player.name)}</strong><br><small>各遊戲分開記錄 · 共玩 ${totalPlayerPlays(player)} 次</small>`;
    const actions = document.createElement('div');
    actions.className = 'manage-actions';
    const clear = document.createElement('button');
    clear.className = 'btn secondary'; clear.textContent = '清除紀錄';
    clear.addEventListener('click', () => showPlayerActionConfirmation('clear', player.id));
    const del = document.createElement('button');
    del.className = 'btn danger'; del.textContent = '刪除';
    del.addEventListener('click', () => showPlayerActionConfirmation('delete', player.id));
    actions.append(clear, del);
    row.append(info, actions);
    root.appendChild(row);
  });
}

function showPlayerActionConfirmation(type, playerId) {
  const player = state.players.find(item => item.id === playerId);
  if (!player) return;
  pendingPlayerAction = { type, playerId };
  document.getElementById('managePlayerList').classList.add('hidden');
  document.getElementById('manageDoneActions').classList.add('hidden');
  const panel = document.getElementById('manageConfirmation');
  const message = type === 'delete'
    ? `確定要刪除「${player.name}」嗎？`
    : `確定要清除「${player.name}」的所有成績嗎？`;
  document.getElementById('manageConfirmText').textContent = message;
  panel.classList.remove('hidden');
  requestAnimationFrame(() => focusFirst(panel));
}

function cancelPlayerAction() {
  pendingPlayerAction = null;
  document.getElementById('manageConfirmation').classList.add('hidden');
  document.getElementById('managePlayerList').classList.remove('hidden');
  document.getElementById('manageDoneActions').classList.remove('hidden');
  requestAnimationFrame(() => focusFirst(document.getElementById('managePlayerList')));
}

function confirmPlayerAction() {
  if (!pendingPlayerAction) return;
  const { type, playerId } = pendingPlayerAction;
  const player = state.players.find(item => item.id === playerId);
  if (!player) return renderManagePlayers();

  if (type === 'clear') {
    player.highScore = 0;
    player.lastScore = null;
    player.plays = 0;
    player.questionStats = {};
    player.progress = createProgressMap();
  } else {
    state.players = state.players.filter(item => item.id !== playerId);
    if (state.currentPlayerId === playerId) state.currentPlayerId = state.players[0]?.id || null;
  }

  saveState();
  renderHome();
  renderManagePlayers();
  requestAnimationFrame(() => focusFirst(screens.manage));
}

function totalPlayerPlays(player) {
  ensurePlayerProgress(player);
  return Object.values(player.progress).reduce((gameTotal, levels) => {
    return gameTotal + Object.values(levels).reduce((levelTotal, record) => levelTotal + (record.plays || 0), 0);
  }, 0);
}

function focusable(root = document) {
  return [...root.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.closest('.hidden') && el.offsetParent !== null);
}

function focusFirst(root = document) {
  const el = focusable(root)[0];
  if (el) focusWithoutScroll(el);
}

function focusWithoutScroll(el) {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  // TV Bro may pan its WebView after focus even when the document cannot
  // normally scroll. Restore the fixed game viewport after that native step.
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

function navigationRoot() {
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) return openDialog;

  if (screens.game.classList.contains('active')) {
    return state.settings.mode === 'choice'
      ? document.getElementById('choiceArea')
      : document.getElementById('keypadGrid');
  }

  return Object.values(screens).find(screen => screen.classList.contains('active')) || document;
}

function moveFocus(direction) {
  const root = navigationRoot();
  const items = focusable(root);
  const current = document.activeElement;
  if (!items.includes(current)) return focusFirst(root);
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

  if (candidates[0]) focusWithoutScroll(candidates[0].el);
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
    if (document.querySelector('dialog[open]')) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.click();
    } else if (game?.answered && screens.game.classList.contains('active')) advanceAfterFeedback();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.click();
    return;
  }

  if (action === 'back') {
    event.preventDefault();
    event.stopPropagation();
    const exitDialog = document.getElementById('exitDialog');
    const playerDialog = document.getElementById('playerDialog');
    if (exitDialog.open) {
      closeExitConfirmation();
    } else if (playerDialog.open) {
      playerDialog.close();
    } else if (screens.manage.classList.contains('active')) {
      if (!document.getElementById('manageConfirmation').classList.contains('hidden')) cancelPlayerAction();
      else {
        renderHome();
        showScreen('players');
      }
    } else if (screens.game.classList.contains('active')) {
      openExitConfirmation();
    } else if (screens.settings.classList.contains('active')) {
      showScreen('games');
    } else if (screens.games.classList.contains('active') || screens.result.classList.contains('active')) {
      showScreen('players');
    }
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
  if (target && target !== document.activeElement) focusWithoutScroll(target);
}, { passive: true });

document.addEventListener('focusin', () => {
  requestAnimationFrame(() => window.scrollTo(0, 0));
});

window.addEventListener('resize', () => window.scrollTo(0, 0));

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'add-player') {
    document.getElementById('playerName').value = '';
    document.getElementById('playerDialog').showModal();
    setTimeout(() => document.getElementById('playerName').focus(), 50);
  }
  if (action === 'manage-player') {
    renderManagePlayers();
    showScreen('manage');
  }
  if (action === 'close-manage') {
    renderHome();
    showScreen('players');
  }
  if (action === 'cancel-player-action') cancelPlayerAction();
  if (action === 'confirm-player-action') confirmPlayerAction();
  if (action === 'choose-game') {
    if (!currentPlayer()) {
      document.getElementById('playerDialog').showModal();
      setTimeout(() => document.getElementById('playerName').focus(), 50);
    } else showScreen('games');
  }
  if (action === 'back-players') showScreen('players');
  if (action === 'back-games') showScreen('games');
  if (action === 'start-game') startGame();
  if (action === 'exit-game') openExitConfirmation();
  if (action === 'continue-game') closeExitConfirmation();
  if (action === 'confirm-exit') {
    document.getElementById('exitDialog').close();
    exitGame();
  }
  if (action === 'play-again') startGame();
  if (action === 'back-home') { game = null; renderHome(); showScreen('players'); }

  const mode = event.target.closest('[data-mode]')?.dataset.mode;
  if (mode) {
    state.settings.mode = mode;
    saveState();
    renderSettings();
  }
  const level = event.target.closest('[data-level]')?.dataset.level;
  if (level) {
    state.settings.level = level;
    saveState();
    renderSettings();
  }
  const gameType = event.target.closest('[data-game]')?.dataset.game;
  if (gameType) selectGame(gameType);
});

document.getElementById('playerForm').addEventListener('submit', event => {
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const input = document.getElementById('playerName');
  createPlayer(input.value);
  document.getElementById('playerDialog').close();
});

document.getElementById('exitDialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeExitConfirmation();
});

document.getElementById('exitDialog').addEventListener('close', () => {
  if (game) game.paused = false;
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
