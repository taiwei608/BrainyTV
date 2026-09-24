const assert = require('node:assert/strict');
const game = require('./stroke-game.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.disabled = false;
    this.open = false;
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name)
    };
  }
  set innerHTML(value) { this.children = []; this._html = value; }
  get innerHTML() { return this._html || ''; }
  appendChild(child) { this.children.push(child); return child; }
  insertBefore(child) { this.children.unshift(child); return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() { this.listeners.click?.({ target: this }); }
  focus() { document.activeElement = this; }
  getTotalLength() { return 100; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelector(selector) {
    if (selector === 'button') return this.children.find(child => child.tag === 'button');
    return this.children.find(child => child.tag === 'button' && !child.disabled);
  }
}

const ids = ['strokeExitDialog', 'strokeProgressSummary', 'strokePlayer', 'strokeRoundText', 'strokeGameTitle', 'strokeBoard', 'strokePrompt', 'strokeChoices', 'strokeNextButton', 'strokeResultSummary'];
const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
global.document = {
  activeElement: null,
  listeners: {},
  createElement: tag => new FakeElement(tag),
  createElementNS: (_, tag) => new FakeElement(tag),
  getElementById: id => elements[id],
  addEventListener(name, callback) { this.listeners[name] = callback; },
  querySelector: selector => selector.startsWith('#strokeChoices') ? elements.strokeChoices.querySelector(selector) : elements.strokeExitDialog.querySelector('button'),
  querySelectorAll: selector => selector === '#strokeChoices button' ? elements.strokeChoices.children : []
};
global.window = {
  matchMedia: () => ({ matches: true }),
  STROKE_DATA: { characters: [{
    char: '三',
    strokes: ['M0 0L10 10', 'M0 20L10 30', 'M0 40L10 50'],
    medians: [[[0, 0], [10, 10]], [[0, 20], [10, 30]], [[0, 40], [10, 50]]]
  }] }
};
global.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 0);
global.cancelAnimationFrame = clearTimeout;

const player = { id: 'one', name: '小明' };
const screens = [];
let saves = 0;
game.init({ getPlayer: () => player, save: () => { saves += 1; }, showScreen: name => screens.push(name) });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  game.open();
  elements.strokeExitDialog.children = [new FakeElement('button')];
  const start = new FakeElement('button');
  start.dataset.strokeAction = 'start';
  start.closest = () => start;
  document.listeners.click({ target: start });
  assert.equal(screens.at(-1), 'strokeGame');
  assert.equal(elements.strokeChoices.children.length, 3);
  await wait(360);

  const wrong = elements.strokeChoices.children.find(button => Number(button.dataset.strokeIndex) !== 0);
  wrong.click();
  assert.equal(elements.strokeGameTitle.textContent, '三');
  assert.equal(wrong.disabled, true);
  assert.equal(wrong.classList.contains('wrong'), true, 'wrong card keeps its red state');
  assert.equal(elements.strokeChoices.children.filter(button => !button.disabled).length, 2);
  assert.equal(player.strokePilot.stats['三']['0'].wrong, 1);
  await wait(360);

  elements.strokeChoices.children.find(button => button.dataset.strokeIndex === '0').click();
  assert.equal(player.strokePilot.stats['三']['0'].correct, 1);
  game.handleBack();
  assert.equal(elements.strokeExitDialog.open, true);
  game.closeExit();
  assert.equal(elements.strokeExitDialog.open, false);
  await wait(310);
  assert.equal(elements.strokeChoices.children.length, 2, 'correct animation advances automatically after Back cancellation');
  assert.ok(elements.strokeChoices.children.every(button => Number(button.dataset.strokeIndex) >= 1));
  await wait(360);

  elements.strokeChoices.children.find(button => button.dataset.strokeIndex === '1').click();
  await wait(600);
  assert.equal(screens.at(-1), 'strokeResult', 'final teaching animation finishes the round automatically');
  assert.match(elements.strokeResultSummary.textContent, /重試 1 次/);
  assert.equal(saves, 4, 'wrong, two correct answers, and round completion are persisted');
  console.log('stroke-game DOM flow tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
