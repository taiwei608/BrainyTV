const STORAGE_KEY = 'family-learning-tv-v1';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const GAME_DEFINITIONS = {
  pokemonNames: { label: '看圖猜寶可夢', symbol: '◉', levels: ['names'] },
  pokemonTypes: { label: '屬性相剋測驗', symbol: '◉', levels: ['types'] },
  multiplication: { label: '九九乘法', symbol: '×', levels: ['all'] },
  addition: { label: '加法挑戰', symbol: '+', levels: ['ones', 'tens', 'hundreds'] },
  subtraction: { label: '減法挑戰', symbol: '−', levels: ['ones', 'tens', 'hundreds'] },
  division: { label: '除法挑戰', symbol: '÷', levels: ['ones', 'tens', 'hundreds'] }
};

const LEVEL_DEFINITIONS = {
  names: { label: '帕底亞圖鑑 400 隻' },
  types: { label: '單一屬性' },
  all: { label: '九九乘法', min: 2, max: 9 },
  ones: { label: '個位數', min: 1, max: 9 },
  tens: { label: '十位數', min: 10, max: 99 },
  hundreds: { label: '百位數', min: 100, max: 999 }
};

const defaultState = {
  players: [],
  currentPlayerId: null,
  settings: { duration: 60, gameType: 'multiplication', level: 'ones' }
};

let state = loadState();
let game = null;
let timerId = null;
let pendingPlayerAction = null;
let audioContext = null;
let creatureSample = null;
let creatureStopTimer = null;

const screens = {
  pokemon: document.getElementById('pokemonScreen'),
  listeningUnits: document.getElementById('listeningUnitsScreen'),
  listening: document.getElementById('listeningScreen'),
  strokeIntro: document.getElementById('strokeIntroScreen'),
  strokeGame: document.getElementById('strokeGameScreen'),
  strokeResult: document.getElementById('strokeResultScreen'),
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

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  } catch {
    return null;
  }
}

function playTone(context, frequency, startAt, duration, type, volume) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function getCreatureSample() {
  if (creatureSample || !window.Audio) return creatureSample;

  try {
    creatureSample = new window.Audio('assets/audio/pika-source.mp3');
    creatureSample.preload = 'auto';
    creatureSample.load();
    return creatureSample;
  } catch {
    return null;
  }
}

function playCreatureSample(correct) {
  const sample = getCreatureSample();
  if (!sample) return false;

  try {
    clearTimeout(creatureStopTimer);
    sample.pause();
    sample.currentTime = 0.02;
    sample.volume = correct ? 1 : 0.9;
    sample.playbackRate = correct ? 1.08 : 0.68;
    sample.preservesPitch = false;
    sample.webkitPreservesPitch = false;

    const playback = sample.play();
    if (playback?.catch) {
      playback.catch(() => {
        if (!playCreatureVoice(correct)) playToneFallback(correct);
      });
    }

    creatureStopTimer = setTimeout(() => {
      sample.pause();
      sample.currentTime = 0;
    }, correct ? 1250 : 1000);
    return true;
  } catch {
    return false;
  }
}

function playCreatureVoice(correct) {
  const SpeechCue = window.SpeechSynthesisUtterance;
  if (!window.speechSynthesis || !SpeechCue) return false;

  try {
    window.speechSynthesis.cancel();
    const cue = new SpeechCue(correct ? '皮卡皮！' : '皮卡……');
    cue.lang = 'zh-TW';
    cue.volume = 1;
    cue.rate = correct ? 1.35 : 0.68;
    cue.pitch = correct ? 1.9 : 0.58;
    const voices = window.speechSynthesis.getVoices();
    cue.voice = voices.find(voice => voice.lang === 'zh-TW') || voices.find(voice => voice.lang.startsWith('zh')) || null;
    window.speechSynthesis.speak(cue);
    return true;
  } catch {
    return false;
  }
}

function playToneFallback(correct) {
  const context = getAudioContext();
  if (!context) return;
  const startAt = context.currentTime + 0.01;

  if (correct) {
    playTone(context, 659.25, startAt, 0.18, 'triangle', 0.11);
    playTone(context, 783.99, startAt + 0.1, 0.18, 'triangle', 0.11);
    playTone(context, 1046.5, startAt + 0.2, 0.24, 'triangle', 0.12);
  } else {
    playTone(context, 220, startAt, 0.32, 'triangle', 0.13);
    playTone(context, 174.61, startAt + 0.24, 0.46, 'triangle', 0.14);
  }
}

function playAnswerSound(correct) {
  if (!playCreatureSample(correct) && !playCreatureVoice(correct)) playToneFallback(correct);
}

function emptyRecord() {
  return { highScore: 0, lastScore: null, plays: 0, questionStats: {}, dailyHighScores: {} };
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function relativeDateKey(daysAgo) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return localDateKey(date);
}

function dailyScore(record, daysAgo = 0) {
  const score = record.dailyHighScores?.[relativeDateKey(daysAgo)];
  return Number.isFinite(Number(score)) ? Number(score) : null;
}

function updateDailyHighScore(record, score) {
  if (!record.dailyHighScores || typeof record.dailyHighScores !== 'object') record.dailyHighScores = {};
  const today = relativeDateKey(0);
  record.dailyHighScores[today] = Math.max(Number(record.dailyHighScores[today]) || 0, score);
  const cutoff = relativeDateKey(120);
  Object.keys(record.dailyHighScores).forEach(date => {
    if (date < cutoff) delete record.dailyHighScores[date];
  });
}

function createProgressMap() {
  return {
    pokemonNames: { names: emptyRecord() },
    multiplication: { all: emptyRecord() },
    addition: { ones: emptyRecord(), tens: emptyRecord(), hundreds: emptyRecord() },
    subtraction: { ones: emptyRecord(), tens: emptyRecord(), hundreds: emptyRecord() },
    division: { ones: emptyRecord(), tens: emptyRecord(), hundreds: emptyRecord() }
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
      if (!record.dailyHighScores || typeof record.dailyHighScores !== 'object') record.dailyHighScores = {};
    });
  });

  return player;
}

function playerRecord(player, gameType = state.settings.gameType, level = selectedLevel(gameType)) {
  ensurePlayerProgress(player);
  return player.progress[gameType][level];
}

function selectedLevel(gameType = state.settings.gameType) {
  if (gameType === 'pokemonNames') return 'names';
  if (gameType === 'pokemonTypes') return 'types';
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
}

function leaderboardResult(gameType, level) {
  const contenders = state.players.map(player => ({
    player,
    record: playerRecord(player, gameType, level)
  })).filter(entry => entry.record.plays > 0);

  if (!contenders.length) return null;
  const highScore = Math.max(...contenders.map(entry => entry.record.highScore));
  return {
    highScore,
    players: contenders.filter(entry => entry.record.highScore === highScore).map(entry => entry.player)
  };
}

function renderGameLeaderboards() {
  const root = document.getElementById('gameLeaderboards');
  root.innerHTML = '';

  Object.entries(GAME_DEFINITIONS).forEach(([gameType, definition]) => {
    const card = document.createElement('article');
    card.className = `leaderboard-card ${gameType}`;
    card.innerHTML = `
      <div class="leaderboard-card-title">
        <span class="leaderboard-symbol" aria-hidden="true">${definition.symbol}</span>
        <strong>${definition.label}</strong>
      </div>
      <div class="leaderboard-levels"></div>
    `;

    const levels = card.querySelector('.leaderboard-levels');
    definition.levels.forEach(level => {
      const result = leaderboardResult(gameType, level);
      const row = document.createElement('div');
      row.className = 'leaderboard-entry';
      if (!result) {
        row.innerHTML = `
          <span class="leaderboard-level">${LEVEL_DEFINITIONS[level].label}</span>
          <span class="leaderboard-player empty">還沒有紀錄</span>
          <strong class="leaderboard-score">—</strong>
        `;
      } else {
        const names = result.players.map(player => escapeHtml(player.name)).join('、');
        row.innerHTML = `
          <span class="leaderboard-level">${LEVEL_DEFINITIONS[level].label}</span>
          <span class="leaderboard-player" title="${names}">👑 ${names}</span>
          <strong class="leaderboard-score">${result.highScore} 分</strong>
        `;
      }
      levels.appendChild(row);
    });

    root.appendChild(card);
  });
}

function selectGame(gameType) {
  if (!GAME_DEFINITIONS[gameType]) return;
  if (gameType.startsWith('pokemon') && !window.POKEMON_DATA) {
    Pokemon.loadData().then(() => selectGame(gameType)).catch(() => Pokemon.open());
    return;
  }
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
  document.getElementById('levelSetting').classList.toggle('hidden', GAME_DEFINITIONS[gameType].levels.length === 1);
  document.getElementById('pokemonQuizRules').classList.toggle('hidden', gameType !== 'pokemonTypes');
  document.getElementById('pokemonNameRules').classList.toggle('hidden', gameType !== 'pokemonNames');
  document.getElementById('multiplicationTableSetting').classList.toggle('hidden', gameType !== 'multiplication');

  document.querySelectorAll('[data-level]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.level === state.settings.level);
  });

  const title = document.getElementById('scoreboardTitle');
  title.textContent = player ? `${player.name}・${definition.label}` : definition.label;
  renderScoreboardRows(player, gameType);
  renderScoreHistory(player, gameType);
}

function renderMultiplicationTable() {
  const root = document.getElementById('multiplicationTableGrid');
  root.innerHTML = '';

  for (let base = 2; base <= 9; base += 1) {
    const column = document.createElement('section');
    column.className = 'multiplication-table-column';
    column.setAttribute('aria-label', `${base} 的乘法`);
    const heading = document.createElement('strong');
    heading.textContent = `${base} 的乘法`;
    column.appendChild(heading);

    for (let multiplier = 2; multiplier <= 9; multiplier += 1) {
      const equation = document.createElement('span');
      equation.textContent = `${base} × ${multiplier} = ${base * multiplier}`;
      column.appendChild(equation);
    }
    root.appendChild(column);
  }
}

function openMultiplicationTable() {
  const dialog = document.getElementById('multiplicationTableDialog');
  renderMultiplicationTable();
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => focusFirst(dialog));
}

function closeMultiplicationTable() {
  const dialog = document.getElementById('multiplicationTableDialog');
  if (dialog.open) dialog.close();
  requestAnimationFrame(() => focusWithoutScroll(document.querySelector('[data-action="open-multiplication-table"]')));
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
    const today = dailyScore(record, 0);
    const yesterday = dailyScore(record, 1);
    let trend = '— 尚無比較';
    let trendClass = 'neutral';
    if (today != null && yesterday != null) {
      const change = today - yesterday;
      trend = change > 0 ? `↑ 進步 ${change} 分` : change < 0 ? `↓ 再加油 ${Math.abs(change)} 分` : '→ 和昨天一樣';
      trendClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    } else if (today != null) {
      trend = '★ 今天的新起點';
      trendClass = 'up';
    }
    row.innerHTML = `
      <strong>${LEVEL_DEFINITIONS[level].label}</strong>
      <span>今天 <b>${today == null ? '—' : `${today} 分`}</b></span>
      <span>昨天 <b>${yesterday == null ? '—' : `${yesterday} 分`}</b></span>
      <span class="score-trend ${trendClass}">${trend}</span>
      <span class="score-details">歷史最高 ${record.highScore} 分 · 最近 ${lastScore} · ${record.plays} 次</span>
    `;
    root.appendChild(row);
  });
}

function renderScoreHistory(player, gameType) {
  const root = document.getElementById('scoreHistory');
  const summary = document.getElementById('historySummary');
  root.innerHTML = '';
  summary.textContent = '';
  if (!player) return;

  const level = selectedLevel(gameType);
  const record = playerRecord(player, gameType, level);
  const entries = Object.entries(record.dailyHighScores || {})
    .filter(([date, score]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(score)))
    .sort(([a], [b]) => a.localeCompare(b));
  const recent = entries.slice(-14);

  document.getElementById('historyTitle').textContent = `${LEVEL_DEFINITIONS[level].label}・最近 14 次紀錄`;
  summary.textContent = entries.length ? `共保存 ${entries.length} 天` : '完成一局後開始累積';

  if (!recent.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '還沒有每日紀錄，今天就來創下第一筆吧！';
    root.appendChild(empty);
    return;
  }

  const maxScore = Math.max(10, ...recent.map(([, score]) => Number(score)));
  recent.forEach(([date, score], index) => {
    const value = Number(score);
    const previous = index ? Number(recent[index - 1][1]) : null;
    const item = document.createElement('div');
    item.className = 'history-day';
    const [, month, day] = date.split('-');
    const change = previous == null ? '' : value > previous ? `+${value - previous}` : value < previous ? `${value - previous}` : '—';
    const changeClass = previous == null ? '' : value > previous ? 'up' : value < previous ? 'down' : '';
    item.innerHTML = `
      <span class="history-score">${value}</span>
      <span class="history-bar-wrap"><i class="history-bar" style="height:${Math.max(8, Math.round(value / maxScore * 100))}%"></i></span>
      <span class="history-date">${Number(month)}/${Number(day)}</span>
      <small class="history-change ${changeClass}">${change}</small>
    `;
    root.appendChild(item);
  });
}

function showScreen(name) {
  if (name !== 'listening') Listening.stop();
  if (name !== 'strokeGame') StrokeGame.leaveScreen();
  if (name === 'games') renderGameLeaderboards();
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
    current: null
  };

  document.getElementById('hudPlayer').textContent = player.name;
  updateHud();
  showScreen('game');
  nextQuestion();

  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!game || game.answered || game.paused || game.imageLoading) return;
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
  game.questionNumber += 1;
  game.current = generateQuestion(playerRecord(currentPlayer(), game.gameType, game.level), game.gameType, game.level);

  document.getElementById('questionMeta').textContent = `${GAME_DEFINITIONS[game.gameType].label}・${LEVEL_DEFINITIONS[game.level].label}・第 ${game.questionNumber} 題`;
  document.getElementById('questionText').textContent = game.current.prompt || `${game.current.a} ${game.current.operator} ${game.current.b} = ?`;
  if (game.current.pokemonType) {
    const question = document.getElementById('questionText');
    const typeLabel = id => {
      const type = window.POKEMON_DATA.types.find(t => t.id === id);
      return `<span class="quiz-type-label">${Pokemon.typeIcon(id)}<span>${escapeHtml(type.name)}屬性</span></span>`;
    };
    question.innerHTML = `<span class="quiz-type-matchup">${typeLabel(game.current.attackType)}<span class="quiz-attack-arrow"><span>攻擊</span><span aria-hidden="true">→</span></span>${typeLabel(game.current.defenseType)}</span><span class="quiz-type-prompt">傷害是幾倍？</span>`;
  }
  screens.game.classList.toggle('pokemon-quiz', game.gameType === 'pokemonTypes');
  screens.game.classList.toggle('pokemon-name-quiz', game.gameType === 'pokemonNames');
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('remoteHint').textContent = '方向鍵選擇答案・OK 確認';
  screens.game.classList.remove('wrong-feedback');
  document.querySelector('.countdown').classList.remove('time-penalty');

  renderChoices();
  renderPokemonQuestionImage();
}

function renderPokemonQuestionImage() {
  const image = document.getElementById('pokemonQuestionImage');
  const retry = document.getElementById('pokemonImageRetry');
  image.onload = image.onerror = null;
  image.classList.add('hidden');
  retry.classList.add('hidden');
  image.removeAttribute('src');
  game.imageLoading = false;
  if (!game.current.pokemonName) return;
  const current = game.current;
  const activeGame = game;
  const feedback = document.getElementById('feedback');
  function load() {
    if (game !== activeGame || game.current !== current) return;
    game.imageLoading = true;
    retry.classList.add('hidden');
    image.classList.add('hidden');
    feedback.textContent = '圖片載入中，倒數暫停…';
    document.querySelectorAll('.answer-btn').forEach(btn => { btn.disabled = true; });
    let settled = false;
    const timeout = setTimeout(() => finish(false), 15000);
    function finish(success) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (game !== activeGame || game.current !== current) return;
      feedback.textContent = success ? '' : '圖片載入失敗，請重試；倒數暫停。';
      if (success) {
        game.imageLoading = false;
        game.answerUnlockAt = Date.now() + 300;
        image.classList.remove('hidden');
        document.querySelectorAll('.answer-btn').forEach(btn => { btn.disabled = false; });
        requestAnimationFrame(() => focusFirst(document.getElementById('choiceArea')));
      } else {
        retry.classList.remove('hidden');
        focusWithoutScroll(retry);
      }
    }
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${current.answer}.png?retry=${Date.now()}`;
  }
  retry.onclick = load;
  load();
}

function generateQuestion(record, gameType, level) {
  if (gameType === 'pokemonNames') return generatePokemonNameQuestion(record);
  if (gameType === 'pokemonTypes') return generatePokemonQuestion(record);
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

function generatePokemonQuestion(record) {
  const candidates = [];
  for (const attack of window.POKEMON_DATA.types) {
    for (const defense of window.POKEMON_DATA.types) {
      const key = `${attack.id}>${defense.id}`;
      const weight = questionWeight(record.questionStats[key] || { correct: 0, wrong: 0 });
      candidates.push({ key, weight, answer: Pokemon.multiplier(attack.id, defense.id),
        attackType: attack.id, defenseType: defense.id,
        prompt: `${attack.name}屬性攻擊 → ${defense.name}屬性\n傷害是幾倍？`, pokemonType: true });
    }
  }
  let pick = Math.random() * candidates.reduce((sum, q) => sum + q.weight, 0);
  return candidates.find(q => (pick -= q.weight) <= 0) || candidates[candidates.length - 1];
}

function generatePokemonNameQuestion(record) {
  const pool = window.POKEMON_DATA.species.filter(s => s.dex.some(d => d[0] === 31));
  const candidates = pool.map(s => ({ species: s, weight: questionWeight(record.questionStats[`name:${s.id}`] || { correct: 0, wrong: 0 }) }));
  let pick = Math.random() * candidates.reduce((sum, q) => sum + q.weight, 0);
  const chosen = (candidates.find(q => (pick -= q.weight) <= 0) || candidates[candidates.length - 1]).species;
  const others = shuffle(pool.filter(s => s.id !== chosen.id)).slice(0, 3);
  return { key: `name:${chosen.id}`, answer: chosen.id, answerName: chosen.name,
    prompt: '這是哪一隻寶可夢？', pokemonName: true,
    choices: shuffle([chosen, ...others]).map(s => s.id) };
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
      const inLevel = gameType === 'division'
        ? parsed && parsed.a / parsed.b >= min && parsed.a / parsed.b <= max
        : parsed && parsed.a >= min && parsed.a <= max && parsed.b >= min && parsed.b <= max;
      if (inLevel) {
        candidates.set(key, { ...parsed, key, weight: questionWeight(stats) + 2 });
      }
    });

  while (candidates.size < 42) {
    let a = randomInteger(min, max);
    let b = randomInteger(min, max);
    if (gameType === 'division') {
      const quotient = a;
      b = randomInteger(2, 9);
      a = quotient * b;
    } else if (gameType === 'subtraction' && b > a) {
      [a, b] = [b, a];
    }
    const operator = gameType === 'addition' ? '+' : gameType === 'division' ? '÷' : '−';
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
  const separator = gameType === 'addition' ? '+' : gameType === 'division' ? '÷' : '−';
  const parts = key.split(separator).map(Number);
  if (parts.length !== 2 || parts.some(value => !Number.isFinite(value))) return null;
  return { a: parts[0], b: parts[1], operator: separator };
}

function calculateAnswer(question, gameType) {
  if (gameType === 'addition') return question.a + question.b;
  if (gameType === 'division') return question.a / question.b;
  return question.a - question.b;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderChoices() {
  document.getElementById('choiceArea').classList.remove('hidden');
  const area = document.getElementById('choiceArea');
  area.innerHTML = '';
  makeChoiceOptions(game.current).forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = game.current.pokemonName ? window.POKEMON_DATA.species.find(s => s.id === value).name : game.current.pokemonType ? pokemonAnswerLabel(value) : value;
    btn.dataset.answerValue = String(value);
    btn.addEventListener('click', () => submitAnswer(value, btn));
    area.appendChild(btn);
  });
  requestAnimationFrame(() => focusFirst(area));
}

function makeChoiceOptions(question) {
  if (question.pokemonName) return question.choices;
  if (question.pokemonType) return shuffle([0, 0.5, 1, 2]);
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

function pokemonAnswerLabel(value) {
  return ({0: '×0 無效', 0.5: '×0.5 效果不好', 1: '×1 一般', 2: '×2 效果絕佳'})[value];
}

function submitAnswer(value, sourceButton) {
  if (!game || game.answered || game.imageLoading) return;
  if (Date.now() < game.answerUnlockAt) return;
  game.answered = true;
  const correct = value === game.current.answer;
  playAnswerSound(correct);
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
  const answerLabel = game.current.answerName || (game.current.pokemonType ? pokemonAnswerLabel(game.current.answer) : game.current.answer);
  feedback.textContent = correct ? `答對了！答案是 ${answerLabel}` : `答錯了！正確答案是 ${answerLabel}，扣 5 秒`;
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

  document.querySelectorAll('.answer-btn').forEach(btn => {
    const v = Number(btn.dataset.answerValue);
    if (v === game.current.answer) btn.classList.add('correct');
    else if (btn === sourceButton) btn.classList.add('wrong');
  });

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
  updateDailyHighScore(record, game.score);
  saveState();

  const total = game.correct + game.wrong;
  const accuracy = total ? Math.round((game.correct / total) * 100) : 0;
  document.getElementById('resultTitle').textContent = `${player.name}，完成！`;
  document.getElementById('finalScore').textContent = game.score;
  document.getElementById('correctCount').textContent = game.correct;
  document.getElementById('wrongCount').textContent = game.wrong;
  document.getElementById('accuracyText').textContent = `${accuracy}%`;
  document.getElementById('highScoreLabel').textContent = GAME_DEFINITIONS[game.gameType].levels.length === 1 ? '本遊戲最高' : '本級最高';
  document.getElementById('highScoreText').textContent = record.highScore;
  const todayHigh = dailyScore(record, 0);
  const yesterdayHigh = dailyScore(record, 1);
  const trendMessage = document.getElementById('resultTrend');
  if (yesterdayHigh == null) {
    trendMessage.textContent = `🌟 今天最高 ${todayHigh} 分，這是你的新起點！`;
    trendMessage.className = 'result-trend up';
  } else {
    const change = todayHigh - yesterdayHigh;
    trendMessage.textContent = change > 0
      ? `🎉 今天最高 ${todayHigh} 分，比昨天進步 ${change} 分！`
      : change === 0
        ? `💪 今天最高 ${todayHigh} 分，和昨天一樣穩定！`
        : `🎯 今天最高 ${todayHigh} 分，距離昨天還差 ${Math.abs(change)} 分！`;
    trendMessage.className = `result-trend ${change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}`;
  }
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
  requestAnimationFrame(() => focusFirst(document.getElementById('choiceArea')));
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
    player.strokePilot = { cursor: 0, practicedChars: [], stats: {} };
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
    .filter(el => !el.closest('.hidden, [hidden], [inert], [aria-hidden="true"]') && !el.disabled && el.offsetParent !== null && el.getClientRects().length > 0);
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
  if (el.closest('#pokemonContent')) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // TV Bro may pan its WebView after focus even when the document cannot
  // normally scroll. Restore the fixed game viewport after that native step.
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

function navigationRoot() {
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) return openDialog;

  if (screens.game.classList.contains('active')) {
    // Include the HUD so D-pad users can reach the visible exit button.
    return screens.game;
  }

  return Object.values(screens).find(screen => screen.classList.contains('active')) || document;
}

// Prefer controls in the same visual row/column. Center distance alone can
// mistake a wide card below the current control for a closer right-hand card.
function directionalTarget(rect, candidates, direction) {
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' || direction === 'down';
  const start = horizontal ? 'left' : 'top', end = horizontal ? 'right' : 'bottom';
  const crossStart = horizontal ? 'top' : 'left', crossEnd = horizontal ? 'bottom' : 'right';
  const center = r => (r[start] + r[end]) / 2;
  const crossCenter = r => (r[crossStart] + r[crossEnd]) / 2;
  return candidates.map(({el, rect:r}, index) => {
    const advance = (center(r) - center(rect)) * (forward ? 1 : -1);
    if (advance <= 8) return null;
    const overlap = Math.min(rect[crossEnd], r[crossEnd]) - Math.max(rect[crossStart], r[crossStart]);
    const aligned = overlap > Math.min(rect[crossEnd]-rect[crossStart],r[crossEnd]-r[crossStart]) * 0.2;
    // Exclude controls wholly above/below for horizontal movement unless
    // their near edge actually lies beyond the current left/right edge.
    const gap = forward ? r[start] - rect[end] : rect[start] - r[end];
    if (!aligned && gap < -2) return null;
    const crossGap = Math.max(0, -overlap);
    if (!aligned && crossGap > advance) return null;
    return {el, aligned, score: Math.max(0,gap) + crossGap * 2.4,
      cross: Math.abs(crossCenter(r)-crossCenter(rect)), advance, index};
  }).filter(Boolean).sort((a,b) => Number(b.aligned)-Number(a.aligned) ||
    a.score-b.score || a.cross-b.cross || a.advance-b.advance || a.index-b.index)[0]?.el;
}

function moveFocus(direction) {
  const root = navigationRoot();
  const items = focusable(root);
  const current = document.activeElement;
  if (!items.includes(current)) return focusFirst(root);
  const target = directionalTarget(current.getBoundingClientRect(),
    items.filter(el => el !== current).map(el => ({el, rect:el.getBoundingClientRect()})), direction);
  if (target) focusWithoutScroll(target);
}

function remoteKey(event) {
  const key = event.key;
  const physicalCode = event.code;
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

  const backKeys = ['Escape', 'BrowserBack', 'GoBack', 'Back', 'Backspace'];
  const isBackspace = key === 'Backspace' || physicalCode === 'Backspace';
  const textField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable;
  const backspaceIsEditing = isBackspace && textField && event.target.value;
  if ((!backspaceIsEditing && (backKeys.includes(key) || backKeys.includes(physicalCode))) || code === 4 || code === 27 || code === 166) return 'back';
  return null;
}

let lastBackActionAt = 0;

function handleBackAction() {
  // Some Android TV browsers emit both a key event and a history event for
  // one press. Treat those as the same action so a dialog is not opened and
  // immediately closed again.
  const now = Date.now();
  if (now - lastBackActionAt < 300) return;
  lastBackActionAt = now;

  const exitDialog = document.getElementById('exitDialog');
  const strokeExitDialog = document.getElementById('strokeExitDialog');
  const playerDialog = document.getElementById('playerDialog');
  const multiplicationTableDialog = document.getElementById('multiplicationTableDialog');
  if (strokeExitDialog.open) {
    StrokeGame.closeExit();
  } else if (multiplicationTableDialog.open) {
    closeMultiplicationTable();
  } else if (exitDialog.open) {
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
  } else if (screens.strokeGame.classList.contains('active')) {
    StrokeGame.handleBack();
  } else if (screens.strokeIntro.classList.contains('active') || screens.strokeResult.classList.contains('active')) {
    showScreen('games');
  } else if (screens.listening.classList.contains('active')) {
    Listening.back();
  } else if (screens.pokemon.classList.contains('active')) {
    Pokemon.back();
  } else if (screens.listeningUnits.classList.contains('active')) {
    showScreen('games');
  } else if (screens.settings.classList.contains('active')) {
    showScreen('games');
  } else if (screens.games.classList.contains('active') || screens.result.classList.contains('active')) {
    showScreen('players');
  }
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
    if (!event.repeat) handleBackAction();
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

// TV Bro can consume the Android Back key as browser history navigation
// without dispatching a KeyboardEvent to the page. A local guard entry turns
// that navigation into the same in-app Back action used by Escape.
const BACK_HISTORY_KEY = 'brainyArenaBackGuard';

function armBackHistoryGuard() {
  try {
    if (history.state?.[BACK_HISTORY_KEY] === 'guard') return;
    const currentState = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...currentState, [BACK_HISTORY_KEY]: 'base' }, document.title);
    history.pushState({ ...currentState, [BACK_HISTORY_KEY]: 'guard' }, document.title);
  } catch {
    // Direct file previews and older TV WebViews may not allow History API
    // changes; their key events are still handled above.
  }
}

window.addEventListener('popstate', () => {
  handleBackAction();
  armBackHistoryGuard();
});

document.addEventListener('backbutton', event => {
  event.preventDefault();
  event.stopPropagation();
  handleBackAction();
  armBackHistoryGuard();
});

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
  if (action === 'open-listening') Listening.open();
  if (action === 'open-pokemon') Pokemon.open();
  if (action === 'open-stroke-game') StrokeGame.open();
  if (action === 'listening-back') Listening.back();
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
  if (action === 'open-multiplication-table') openMultiplicationTable();
  if (action === 'close-multiplication-table') closeMultiplicationTable();
  if (action === 'start-game') startGame();
  if (action === 'exit-game') openExitConfirmation();
  if (action === 'continue-game') closeExitConfirmation();
  if (action === 'confirm-exit') {
    document.getElementById('exitDialog').close();
    exitGame();
  }
  if (action === 'play-again') startGame();
  if (action === 'back-home') { game = null; renderHome(); showScreen('players'); }

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

document.getElementById('multiplicationTableDialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeMultiplicationTable();
});

document.getElementById('exitDialog').addEventListener('close', () => {
  if (game) game.paused = false;
});

StrokeGame.init({
  getPlayer: currentPlayer,
  save: saveState,
  showScreen
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

armBackHistoryGuard();
renderHome();
focusFirst();
