// Run with node listening.test.cjs. Exercise queue transitions with a fake media element.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor() { this.dataset = {}; this.children = []; this.events = {}; this.classList = { toggle() {} }; this.paused = true; this.currentTime = 0; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute() {}
  removeAttribute(name) { delete this[name]; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  get firstElementChild() { return this.children[0]; }
  load() { this.currentTime = 0; }
  pause() { this.paused = true; this.events.pause?.(); }
  play() { this.paused = false; this.events.playing?.(); return Promise.resolve(); }
  closest() { return this; }
}
const ids = new Map();
const controls = new Map();
const languages = ['zh', 'en'].map(language => { const el = new Element(); el.dataset.listeningLanguage = language; return el; });
const listeners = [];
const document = {
  getElementById(id) { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); },
  createElement() { return new Element(); },
  addEventListener(event, callback) { if (event === 'click') listeners.push(callback); },
  querySelectorAll(selector) { return selector.includes('language') ? languages : this.getElementById('listeningTracks').children; },
  querySelector(selector) { if (!controls.has(selector)) controls.set(selector, new Element()); return controls.get(selector); }
};
let screen;
let player = { name: '小明' }, savedPlayer;
const context = vm.createContext({ document, currentPlayer: () => player, saveState: () => { savedPlayer = JSON.stringify(player); }, window: { addEventListener() {} }, requestAnimationFrame: fn => fn(), focusWithoutScroll() {}, showScreen(name) { screen = name; if (name !== 'listening') vm.runInContext('Listening.stop()', context); } });
vm.runInContext(readFileSync('listening-data.js', 'utf8') + '\n' + readFileSync('listening.js', 'utf8'), context);
const audio = document.getElementById('listeningAudio');
function click(dataset) { const button = new Element(); button.dataset = dataset; listeners.forEach(fn => fn({ target: button })); }
const get = expression => vm.runInContext(expression, context);
const status = () => document.getElementById('listeningStatus').textContent;
assert.equal(get('LISTENING_TRACKS.length'), 74);
assert.equal(get('new Set(LISTENING_TRACKS.map(t => t.src)).size'), 74);
for (let unit = 1; unit <= 7; unit++) {
  assert.equal(get(`LISTENING_TRACKS.filter(t=>t.unit===${unit}&&t.language==='zh').length`), 6);
  assert.equal(get(`LISTENING_TRACKS.filter(t=>t.unit===${unit}&&t.language==='en').length`), 4);
}
get('Listening.open()');
click({ listeningUnit: '1' });
assert.equal(screen, 'listening');
assert.match(document.getElementById('listeningMode').textContent, /單元連播/);
click({ listeningTrack: '1' });
assert.match(audio.src, /02-Unit-1-Story-2/);
const storySource = audio.src;
assert.equal(player.listeningPlays[storySource], 1);
audio.events.playing(); // Buffering recovery must not inflate the count.
click({ listeningControl: 'play' }); // Pause.
click({ listeningControl: 'play' }); // Resume.
assert.equal(player.listeningPlays[storySource], 1);
click({ listeningControl: 'restart' });
assert.equal(player.listeningPlays[storySource], 2);
assert.match(document.getElementById('listeningDetail').textContent, /已播放 2 次/);
assert.match(document.getElementById('listeningTracks').children[0].children[1].textContent, /已播放 2 次/);
audio.events.ended();
assert.match(audio.src, /03-Unit-1-Chant-2/);
click({ listeningTrack: '6' });
audio.paused = true;
audio.events.ended();
assert.match(status(), /單元聽完/);
assert.match(audio.src, /07-Unit-1-Games-2/); // Must not jump to Unit 2.
click({ listeningTrack: '1' });
click({ listeningLanguage: 'en' });
assert.match(audio.src, /26-Unit-1-Story-5/);
assert.equal(document.getElementById('listeningTracks').children.length, 4);
audio.events.ended();
assert.match(audio.src, /27-Unit-1-Say-it-out-2/);
click({ listeningControl: 'mode' });
const repeated = audio.src;
const beforeRepeat = player.listeningPlays[repeated];
audio.events.ended();
assert.equal(audio.src, repeated);
assert.equal(player.listeningPlays[repeated], beforeRepeat + 1);
click({ listeningControl: 'mode' });
audio.events.ended();
assert.match(status(), /這首聽完/);
get('Listening.back()');
assert.equal(audio.paused, true);
assert.equal(audio.src, undefined);
click({ listeningUnit: '0' });
assert.equal(languages[1].disabled, true);
assert.equal(document.getElementById('listeningTracks').children.length, 4);
click({ listeningControl: 'play' });
audio.events.error();
assert.match(status(), /重試/);
get('Listening.open()');
click({ listeningUnit: '7' });
assert.match(document.getElementById('listeningMode').textContent, /單元連播/);
get('Listening.stop()');
player = JSON.parse(savedPlayer); // Reload persisted player data.
click({ listeningUnit: '1' });
click({ listeningLanguage: 'zh' });
assert.match(document.getElementById('listeningTracks').children[0].children[1].textContent, /已播放 3 次/);
const firstPlayer = player;
get('Listening.stop()');
player = { name: '小美' };
click({ listeningUnit: '1' });
assert.match(document.getElementById('listeningTracks').children[0].children[1].textContent, /已播放 0 次/);
const originalPlay = audio.play;
audio.play = () => Promise.resolve(); // Loading alone, without successful playing.
click({ listeningTrack: '1' });
audio.events.error();
assert.equal(player.listeningPlays, undefined);
audio.play = originalPlay;
click({ listeningControl: 'play' });
assert.equal(player.listeningPlays[storySource], 1);
assert.equal(firstPlayer.listeningPlays[storySource], 3);
console.log('PASS: successful starts only, pause/buffering deduplication, replay/repeat, persisted display and player isolation.');
console.log('PASS: 74 sources, bilingual queues, unit boundary, language switch, repeat/single, back cleanup, extras, error state, default mode.');
