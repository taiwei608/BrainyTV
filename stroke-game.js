(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StrokeGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ROUND_SIZE = 5;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let hooks = null;
  let session = null;
  let animationFrame = null;
  let animationTimer = null;
  let animationToken = 0;
  let activationLockedUntil = 0;

  function isTeachingStep(strokeIndex, strokeCount) {
    return strokeCount > 0 && strokeIndex === strokeCount - 1;
  }

  function normalizePilot(pilot) {
    const value = pilot && typeof pilot === 'object' ? pilot : {};
    return {
      cursor: Math.max(0, Number(value.cursor) || 0),
      practicedChars: Array.isArray(value.practicedChars) ? [...new Set(value.practicedChars.filter(item => typeof item === 'string'))] : [],
      stats: value.stats && typeof value.stats === 'object' ? JSON.parse(JSON.stringify(value.stats)) : {}
    };
  }

  function ensurePlayerPilot(player) {
    if (!player) return null;
    player.strokePilot = normalizePilot(player.strokePilot);
    return player.strokePilot;
  }

  function chooseRound(characters, cursor, size) {
    if (!Array.isArray(characters) || !characters.length) return [];
    const count = Math.min(size || ROUND_SIZE, characters.length);
    return Array.from({ length: count }, (_, offset) => characters[(cursor + offset) % characters.length]);
  }

  function buildOptions(character, strokeIndex, maxOptions) {
    const count = character?.strokes?.length || 0;
    if (!count || strokeIndex < 0 || strokeIndex >= count || isTeachingStep(strokeIndex, count)) return [];
    const others = [];
    for (let distance = 1; distance < count; distance += 1) {
      const after = strokeIndex + distance;
      const before = strokeIndex - distance;
      if (after < count) others.push(after);
      if (before >= 0) others.push(before);
    }
    const optionCount = Math.min(Math.max(2, maxOptions || 4), 4, count);
    const indexes = [strokeIndex, ...others.filter(index => index !== strokeIndex)].slice(0, optionCount);
    return indexes.map(index => ({
      strokeIndex: index,
      correct: index === strokeIndex,
      contextKey: `${character.char}:${index}`
    }));
  }

  function recordAttempt(pilot, char, strokeIndex, correct) {
    const next = normalizePilot(pilot);
    if (!next.stats[char] || typeof next.stats[char] !== 'object') next.stats[char] = {};
    const key = String(strokeIndex);
    const old = next.stats[char][key] || {};
    next.stats[char][key] = {
      attempts: (Number(old.attempts) || 0) + 1,
      correct: (Number(old.correct) || 0) + (correct ? 1 : 0),
      wrong: (Number(old.wrong) || 0) + (correct ? 0 : 1)
    };
    return next;
  }

  function advanceCursor(cursor, completed, total) {
    return total ? (Math.max(0, Number(cursor) || 0) + Math.max(0, Number(completed) || 0)) % total : 0;
  }

  function canAdvance(phase, now, unlockAt) { return (phase === 'ready' || phase === 'demo-ready') && now >= unlockAt; }
  function resumeAction(mode, phase) {
    if (mode === 'demo') return phase === 'demo-ready' ? 'focus' : 'replay-demo';
    if (phase === 'animating') return 'replay-stroke';
    if (phase === 'ready') return 'focus';
    return 'focus-choice';
  }

  function createSvg(character, highlighted, completedThrough, options) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${character.char}的候選筆畫位置`);
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', 'scale(1,-1) translate(0,-900)');
    character.strokes.forEach((pathData, index) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('class', index === highlighted ? 'glyph-stroke proposed' : index <= completedThrough ? 'glyph-stroke completed' : 'glyph-stroke context');
      group.appendChild(path);
    });
    svg.appendChild(group);
    if (options?.grid) addGrid(svg);
    return svg;
  }

  function addGrid(svg) {
    const grid = document.createElementNS(SVG_NS, 'g');
    grid.setAttribute('class', 'tian-lines');
    [['M512 0V1024'], ['M0 512H1024'], ['M0 0L1024 1024'], ['M1024 0L0 1024']].forEach(([d]) => {
      const line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('d', d); grid.appendChild(line);
    });
    svg.insertBefore(grid, svg.firstChild);
  }

  function dataCharacters() {
    return (window.STROKE_DATA?.characters || []).filter(item => item?.char && Array.isArray(item.strokes) && item.strokes.length && Array.isArray(item.medians));
  }

  function init(nextHooks) {
    hooks = nextHooks;
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-stroke-action]')?.dataset.strokeAction;
      if (!action) return;
      if (action === 'start' || action === 'again') start();
      if (action === 'demo') startDemo();
      if (action === 'back' || action === 'home') hooks.showScreen('games');
      if (action === 'exit') openExit();
      if (action === 'continue') closeExit();
      if (action === 'confirm-exit') { const dialog = document.getElementById('strokeExitDialog'); if (dialog.open) dialog.close(); session = null; hooks.showScreen('strokeIntro'); renderIntro(); }
      if (action === 'next') nextStep();
    });
    document.getElementById('strokeExitDialog')?.addEventListener('cancel', event => { event.preventDefault(); closeExit(); });
  }

  function open() {
    const player = hooks.getPlayer();
    if (!player) return;
    ensurePlayerPilot(player);
    renderIntro();
    hooks.showScreen('strokeIntro');
  }

  function renderIntro() {
    const pilot = ensurePlayerPilot(hooks.getPlayer());
    const count = pilot?.practicedChars.length || 0;
    document.getElementById('strokeProgressSummary').textContent = count ? `已練習過 ${count} 個字` : '還沒有練習紀錄，從第一個字開始吧！';
  }

  function start() {
    const characters = dataCharacters();
    const player = hooks.getPlayer();
    if (!characters.length || !player) {
      document.getElementById('strokeProgressSummary').textContent = '筆順資料尚未準備好，請稍後再試。';
      return;
    }
    const pilot = ensurePlayerPilot(player);
    session = { mode: 'play', phase: 'choices', playerId: player.id, round: chooseRound(characters, pilot.cursor, ROUND_SIZE), charAt: 0, strokeAt: 0, correct: 0, wrong: 0, answered: false };
    document.getElementById('strokePlayer').textContent = player.name;
    hooks.showScreen('strokeGame');
    renderStep();
  }

  function startDemo() {
    const characters = dataCharacters();
    if (!characters.length) return renderIntro();
    const player = hooks.getPlayer();
    const pilot = ensurePlayerPilot(player);
    session = { mode: 'demo', phase: 'animating', playerId: player.id, round: chooseRound(characters, pilot.cursor, ROUND_SIZE), charAt: 0, strokeAt: 0, answered: true };
    document.getElementById('strokePlayer').textContent = player.name;
    hooks.showScreen('strokeGame');
    playDemo();
  }

  function currentCharacter() { return session?.round[session.charAt]; }

  function renderStep() {
    cancelAnimation();
    const character = currentCharacter();
    if (!character) return finishRound();
    const total = character.strokes.length;
    document.getElementById('strokeRoundText').textContent = `${session.charAt + 1} / ${session.round.length}`;
    document.getElementById('strokeGameTitle').textContent = character.char;
    const board = document.getElementById('strokeBoard');
    board.innerHTML = '';
    board.appendChild(createSvg(character, -1, session.strokeAt - 1, { grid: true }));
    const teaching = isTeachingStep(session.strokeAt, total);
    document.getElementById('strokePrompt').textContent = teaching ? '最後一筆，跟著方向看一次' : `第 ${session.strokeAt + 1} 筆是哪一個？`;
    const choices = document.getElementById('strokeChoices');
    choices.innerHTML = '';
    document.getElementById('strokeNextButton').classList.add('hidden');
    session.answered = false;
    session.phase = 'choices';
    if (teaching) {
      session.answered = true;
      session.phase = 'animating';
      animateStroke(character, session.strokeAt, () => showNext('看完了，下一個'));
      return;
    }
    const options = shuffle(buildOptions(character, session.strokeAt, 4).slice());
    options.forEach(option => {
      const button = document.createElement('button');
      button.className = 'stroke-choice';
      button.dataset.strokeIndex = String(option.strokeIndex);
      button.setAttribute('aria-label', `候選答案 ${String.fromCharCode(65 + choices.children.length)}`);
      button.appendChild(createSvg(character, option.strokeIndex, -1));
      button.addEventListener('click', () => chooseStroke(option, button));
      choices.appendChild(button);
    });
    requestAnimationFrame(() => choices.querySelector('button')?.focus({ preventScroll: true }));
  }

  function chooseStroke(option, button) {
    if (!session || session.answered || Date.now() < activationLockedUntil) return;
    session.answered = true;
    session.phase = 'animating';
    activationLockedUntil = Date.now() + 350;
    const correct = option.correct;
    const player = hooks.getPlayer();
    if (!player || player.id !== session.playerId) return;
    player.strokePilot = recordAttempt(player.strokePilot, currentCharacter().char, session.strokeAt, correct);
    correct ? session.correct += 1 : session.wrong += 1;
    hooks.save();
    document.querySelectorAll('#strokeChoices button').forEach(item => { item.disabled = true; });
    button.classList.add(correct ? 'correct' : 'wrong');
    document.getElementById('strokePrompt').textContent = correct ? '答對了！看清楚書寫方向' : '再看一次，正確的下一筆是這樣';
    animateStroke(currentCharacter(), session.strokeAt, () => showNext('下一筆'));
  }

  function showNext(label) {
    if (!session) return;
    session.phase = session.mode === 'demo' ? 'demo-ready' : 'ready';
    const button = document.getElementById('strokeNextButton');
    button.textContent = label;
    button.classList.remove('hidden');
    activationLockedUntil = Date.now() + 300;
    requestAnimationFrame(() => button.focus({ preventScroll: true }));
  }

  function nextStep() {
    if (!session || !canAdvance(session.phase, Date.now(), activationLockedUntil)) return;
    if (session.mode === 'demo' && session.demoComplete) { session.demoComplete = false; playDemo(); return; }
    const character = currentCharacter();
    if (session.strokeAt + 1 < character.strokes.length) session.strokeAt += 1;
    else { session.charAt += 1; session.strokeAt = 0; }
    renderStep();
  }

  function animateStroke(character, index, done) {
    cancelAnimation();
    const token = animationToken;
    const board = document.getElementById('strokeBoard');
    board.innerHTML = '';
    const svg = createSvg(character, -1, index - 1, { grid: true });
    const clipId = `stroke-clip-${Date.now()}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    const clip = document.createElementNS(SVG_NS, 'clipPath'); clip.id = clipId;
    const outline = document.createElementNS(SVG_NS, 'path'); outline.setAttribute('d', character.strokes[index]); outline.setAttribute('transform', 'scale(1,-1) translate(0,-900)');
    clip.appendChild(outline); defs.appendChild(clip); svg.appendChild(defs);
    const median = character.medians[index] || [];
    const reveal = document.createElementNS(SVG_NS, 'polyline');
    reveal.setAttribute('points', median.map(point => `${point[0]},${900 - point[1]}`).join(' '));
    reveal.setAttribute('class', 'stroke-reveal'); reveal.setAttribute('clip-path', `url(#${clipId})`);
    svg.appendChild(reveal); board.appendChild(svg);
    const length = Math.max(1, reveal.getTotalLength ? reveal.getTotalLength() : 1000);
    reveal.style.strokeDasharray = String(length); reveal.style.strokeDashoffset = String(length);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { reveal.style.strokeDashoffset = '0'; animationTimer = setTimeout(() => { if (token === animationToken) done(); }, 250); return; }
    const startAt = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - startAt) / 900);
      reveal.style.strokeDashoffset = String(length * (1 - progress));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else animationTimer = setTimeout(() => { if (token === animationToken) done(); }, 250);
    };
    animationFrame = requestAnimationFrame(tick);
  }

  function playDemo() {
    const character = currentCharacter();
    if (!character) return finishDemo();
    document.getElementById('strokeRoundText').textContent = `示範 ${session.charAt + 1} / ${session.round.length}`;
    document.getElementById('strokeGameTitle').textContent = character.char;
    document.getElementById('strokePrompt').textContent = `第 ${session.strokeAt + 1} 筆`;
    document.getElementById('strokeChoices').innerHTML = '';
    document.getElementById('strokeNextButton').classList.add('hidden');
    session.phase = 'animating';
    animateStroke(character, session.strokeAt, () => {
      if (++session.strokeAt >= character.strokes.length) { session.strokeAt = 0; session.charAt += 1; }
      if (session.charAt < session.round.length) animationTimer = setTimeout(playDemo, 300);
      else finishDemo();
    });
  }

  function finishDemo() {
    session.charAt = 0; session.strokeAt = 0;
    session.demoComplete = true;
    session.phase = 'demo-ready';
    document.getElementById('strokePrompt').textContent = '示範看完了，可以再播放一次';
    const button = document.getElementById('strokeNextButton');
    button.textContent = '重新播放'; button.classList.remove('hidden');
    button.focus({ preventScroll: true });
  }

  function finishRound() {
    const player = hooks.getPlayer();
    if (player && player.id === session.playerId) {
      const pilot = ensurePlayerPilot(player);
      pilot.cursor = advanceCursor(pilot.cursor, session.round.length, dataCharacters().length);
      pilot.practicedChars = [...new Set([...pilot.practicedChars, ...session.round.map(item => item.char)])];
      hooks.save();
    }
    document.getElementById('strokeResultSummary').textContent = `練習過 ${session.round.length} 個字・答對 ${session.correct} 次・再看 ${session.wrong} 次`;
    hooks.showScreen('strokeResult');
  }

  function handleBack() { if (session) openExit(); else hooks.showScreen('games'); }
  function openExit() { cancelAnimation(); const dialog = document.getElementById('strokeExitDialog'); if (!dialog.open) dialog.showModal(); setTimeout(() => document.querySelector('#strokeExitDialog button')?.focus(), 30); }
  function closeExit() {
    const dialog = document.getElementById('strokeExitDialog');
    if (dialog.open) dialog.close();
    if (!session) return;
    const action = resumeAction(session.mode, session.phase);
    if (action === 'replay-demo') playDemo();
    else if (action === 'replay-stroke') animateStroke(currentCharacter(), session.strokeAt, () => showNext(isTeachingStep(session.strokeAt, currentCharacter().strokes.length) ? '看完了，下一個' : '下一筆'));
    else if (action === 'focus') requestAnimationFrame(() => document.getElementById('strokeNextButton')?.focus({ preventScroll: true }));
    else requestAnimationFrame(() => document.querySelector('#strokeChoices button:not([disabled])')?.focus({ preventScroll: true }));
  }
  function leaveScreen() { cancelAnimation(); session = null; }
  function cancelAnimation() { animationToken += 1; if (animationFrame) cancelAnimationFrame(animationFrame); if (animationTimer) clearTimeout(animationTimer); animationFrame = null; animationTimer = null; }
  function shuffle(items) { for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; }

  return { init, open, leaveScreen, handleBack, closeExit, isTeachingStep, normalizePilot, chooseRound, buildOptions, recordAttempt, advanceCursor, canAdvance, resumeAction };
});
