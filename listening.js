/* One shared audio element; queues never cross unit or language boundaries. */
const Listening = (() => {
  const audio = document.getElementById('listeningAudio');
  const labels = { Story: '故事', Chant: '韻文', 'Say-it-out': '開口說', Song: '歌曲', ABC: 'ABC', Games: '遊戲活動', Review: '複習', 'Super Fun': 'Super Fun 歌曲', 'Polite Kids': 'Polite Kids 歌曲' };
  const modes = ['單元連播', '單曲重複', '單首播放'];
  let unit = 1, language = 'zh', mode = 0, current = null, request = 0;
  let counted = false;
  const playCount = track => {
    const value = currentPlayer()?.listeningPlays?.[track.src];
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const el = id => document.getElementById(id);
  const queue = () => LISTENING_TRACKS.filter(t => t.unit === unit && t.language === language);
  const unitName = () => unit ? `第 ${unit} 單元 · Unit ${unit}` : '其他歌曲／複習';
  const status = text => { el('listeningStatus').textContent = text; };
  const time = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';

  function stop() {
    request++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = null;
    counted = false;
  }

  function render() {
    el('listeningTitle').textContent = unitName();
    document.querySelectorAll('[data-listening-language]').forEach(button => {
      const selected = button.dataset.listeningLanguage === language;
      button.classList.toggle('primary', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = !LISTENING_TRACKS.some(t => t.unit === unit && t.language === button.dataset.listeningLanguage);
    });
    el('listeningLanguageHint').textContent = `${unit === 0 ? '這組音檔未另列全英版本。' : '全英版提供故事、開口說、ABC、遊戲活動。'} 播放次數：${currentPlayer()?.name || '目前玩家'}。`;
    el('listeningTracks').replaceChildren(...queue().map(track => {
      const button = document.createElement('button');
      button.className = 'btn listening-track';
      button.dataset.listeningTrack = track.id;
      const title = document.createElement('strong');
      title.textContent = labels[track.type];
      const subtitle = document.createElement('small');
      subtitle.textContent = track.type.replace('Say-it-out', 'Say It Out');
      button.append(title, subtitle);
      return button;
    }));
    update();
  }

  function update() {
    const tracks = queue();
    const index = tracks.indexOf(current);
    el('listeningNow').textContent = current ? labels[current.type] : '選一首開始聽';
    el('listeningDetail').textContent = current ? `${language === 'zh' ? '中英' : '全英'} · 第 ${index + 1} / ${tracks.length} 首 · 已播放 ${playCount(current)} 次` : '按左邊的內容即可播放';
    el('listeningPlay').textContent = audio.paused ? '▶ 播放' : '❚❚ 暫停';
    el('listeningMode').textContent = `模式：${modes[mode]}`;
    document.querySelector('[data-listening-control="previous"]').disabled = index <= 0;
    document.querySelector('[data-listening-control="next"]').disabled = index < 0 || index >= tracks.length - 1;
    document.querySelector('[data-listening-control="restart"]').disabled = !current;
    if (document.activeElement?.disabled && document.activeElement.dataset.listeningControl) {
      focusWithoutScroll(el('listeningPlay'));
    }
    document.querySelectorAll('[data-listening-track]').forEach(button => {
      const track = tracks.find(t => t.id === Number(button.dataset.listeningTrack));
      button.children[1].textContent = `${track.type.replace('Say-it-out', 'Say It Out')} · 已播放 ${playCount(track)} 次`;
      const selected = Number(button.dataset.listeningTrack) === current?.id;
      button.classList.toggle('primary', selected);
      button.setAttribute('aria-current', selected ? 'true' : 'false');
    });
    updateTime();
  }

  function updateTime() {
    el('listeningTime').textContent = `${time(audio.currentTime)} / ${time(audio.duration)}`;
    el('listeningProgress').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
  }

  function play(track, reload = false) {
    if (!track) return;
    const token = ++request;
    if (current !== track || reload) {
      if (current !== track) counted = false;
      audio.pause();
      current = track;
      audio.src = track.src;
      audio.load();
    }
    status('正在載入音檔…');
    update();
    const result = audio.play();
    if (result?.catch) result.catch(error => {
      if (token !== request) return;
      status(error.name === 'NotAllowedError' ? '請按播放，繼續收聽。' : '音檔暫時無法播放，請按播放重試，或選其他曲目。');
      update();
    });
  }

  function open() {
    stop();
    mode = 0;
    el('listeningUnits').replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 0].map(number => {
      const button = document.createElement('button');
      button.className = 'btn listening-unit';
      button.dataset.listeningUnit = number;
      button.textContent = number ? `第 ${number} 單元 · Unit ${number}` : '♫ 其他歌曲／複習';
      return button;
    }));
    showScreen('listeningUnits');
  }

  function back() {
    showScreen('listeningUnits');
    requestAnimationFrame(() => focusWithoutScroll(document.querySelector(`[data-listening-unit="${unit}"]`)));
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.listeningUnit !== undefined) {
      stop();
      unit = Number(button.dataset.listeningUnit);
      if (!queue().length) language = 'zh';
      render();
      status('選一首後，會依目前模式播放。');
      showScreen('listening');
      requestAnimationFrame(() => focusWithoutScroll(el('listeningTracks').firstElementChild));
    }
    if (button.dataset.listeningLanguage) {
      const nextLanguage = button.dataset.listeningLanguage;
      if (nextLanguage === language) return;
      const type = current?.type;
      const wasPlaying = !!current && !audio.paused;
      stop();
      language = nextLanguage;
      render();
      const equivalent = queue().find(t => t.type === type);
      if (wasPlaying && equivalent) play(equivalent);
      else status('已切換語言，請選一首開始聽。');
    }
    if (button.dataset.listeningTrack !== undefined) play(queue().find(t => t.id === Number(button.dataset.listeningTrack)));
    const control = button.dataset.listeningControl;
    if (control === 'play') {
      if (!audio.paused) { request++; audio.pause(); status('已暫停'); }
      else play(current || queue()[0], !!audio.error);
    }
    if (control === 'previous' || control === 'next') play(queue()[queue().indexOf(current) + (control === 'next' ? 1 : -1)]);
    if (control === 'restart' && current) { counted = false; audio.currentTime = 0; play(current, !!audio.error); }
    if (control === 'mode') { mode = (mode + 1) % modes.length; update(); }
  });

  audio.addEventListener('ended', () => {
    if (!current) return;
    counted = false;
    if (mode === 1) { audio.currentTime = 0; play(current); }
    else if (mode === 0 && queue().indexOf(current) < queue().length - 1) play(queue()[queue().indexOf(current) + 1]);
    else { status(mode === 0 ? '這個單元聽完了！可以重播或選其他單元。' : '這首聽完了！'); update(); }
  });
  audio.addEventListener('playing', () => {
    if (!current || audio.paused) return;
    status('播放中');
    const player = currentPlayer();
    if (!counted && player) {
      counted = true;
      const count = playCount(current);
      if (!player.listeningPlays || typeof player.listeningPlays !== 'object' || Array.isArray(player.listeningPlays)) player.listeningPlays = {};
      player.listeningPlays[current.src] = Math.min(count + 1, Number.MAX_SAFE_INTEGER);
      try { saveState(); } catch { status('播放中；紀錄暫時無法儲存，關閉頁面後可能遺失。'); }
    }
    update();
  });
  audio.addEventListener('pause', update);
  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('waiting', () => { if (current) status('音檔緩衝中…'); });
  audio.addEventListener('error', () => { if (current) { status('音檔暫時無法播放，請按播放重試，或選其他曲目。'); update(); } });
  window.addEventListener('pagehide', stop);
  return { open, back, stop };
})();
