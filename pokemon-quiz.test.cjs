const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({ window: {}, Math: Object.create(Math) });
vm.runInContext(fs.readFileSync('pokemon-data.js', 'utf8'), context);
context.Pokemon = { multiplier(a, b) { return context.window.POKEMON_DATA.efficacy.find(r => r[0] === a && r[1] === b)[2]; } };
function include(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
vm.runInContext(source.slice(source.indexOf('const GAME_DEFINITIONS'), source.indexOf('const defaultState')), context);
for (const name of ['questionWeight', 'generatePokemonQuestion', 'generatePokemonNameQuestion', 'generateQuestion', 'shuffle', 'makeChoiceOptions', 'emptyRecord', 'createProgressMap', 'ensurePlayerProgress', 'playerRecord', 'selectedLevel']) include(name);
const record = { questionStats: {} };
// Traverse every pair with deterministic picks; compare against the offline table.
const seen = new Set();
for (let i = 0; i < 324; i++) {
  context.Math.random = () => (i + 0.5) / 324;
  const q = context.generateQuestion(record, 'pokemonTypes', 'types');
  seen.add(q.key);
  const [a, b] = q.key.split('>').map(Number);
  assert.equal(q.answer, context.Pokemon.multiplier(a, b));
  assert.match(q.prompt, /屬性攻擊 → .*屬性/);
  assert.deepEqual(Array.from(context.makeChoiceOptions(q)).sort((a,b)=>a-b), [0,0.5,1,2]);
}
assert.equal(seen.size, 324);
assert.equal(context.selectedLevel('pokemonTypes'), 'types');
const player = { highScore: 100, progress: { multiplication: { all: { highScore: 200 } } } };
context.ensurePlayerProgress(player);
assert.equal(player.progress.pokemonTypes.types.highScore, 0);
assert.equal(player.progress.multiplication.all.highScore, 200);
player.progress.pokemonTypes.types.highScore = 80;
const restored = JSON.parse(JSON.stringify(player));
context.ensurePlayerProgress(restored);
assert.equal(context.playerRecord(restored, 'pokemonTypes', 'types').highScore, 80);
assert.ok(context.questionWeight({correct:0,wrong:3}) > context.questionWeight({correct:3,wrong:0}));
console.log('PASS: all 324 matchup questions, four choices, wrong-answer weighting, independent player records and persisted highest score.');

const nameSeen = new Set();
for (let i = 0; i < 99; i++) {
  context.Math.random = () => (i + 0.5) / 99;
  const q = context.generateQuestion(record, 'pokemonNames', 'names');
  nameSeen.add(q.answer);
  assert.equal(q.choices.length, 4);
  assert.equal(new Set(q.choices).size, 4);
  assert.ok(q.choices.includes(q.answer));
  assert.equal(q.answerName, context.window.POKEMON_DATA.species.find(s => s.id === q.answer).name);
  assert.ok(q.choices.every(id => id >= 1 && id <= 151));
}
assert.equal(nameSeen.size, 99);
assert.equal(context.selectedLevel('pokemonNames'), 'names');
assert.equal(context.playerRecord(restored, 'pokemonNames', 'names').highScore, 0);
assert.equal(context.playerRecord(restored, 'pokemonTypes', 'types').highScore, 80);
console.log('PASS: all 99 name questions, distinct choices, matching names and separate records.');

const imageElements = new Map();
const answers = [{disabled:false}, {disabled:false}];
context.document = {
  getElementById(id) {
    if (!imageElements.has(id)) imageElements.set(id, {classList:{add(){},remove(){}},removeAttribute(){},textContent:''});
    return imageElements.get(id);
  },
  querySelectorAll() { return answers; }
};
context.setTimeout = () => 1;
context.clearTimeout = () => {};
context.requestAnimationFrame = fn => fn();
context.focusFirst = context.focusWithoutScroll = () => {};
context.game = {current:{pokemonName:true,answer:25}};
include('renderPokemonQuestionImage');
context.renderPokemonQuestionImage();
assert.equal(context.game.imageLoading,true);
assert.ok(answers.every(a=>a.disabled));
const image = imageElements.get('pokemonQuestionImage');
assert.match(image.src, /pokemon\/25\.png/);
image.onerror();
assert.equal(context.game.imageLoading,true);
imageElements.get('pokemonImageRetry').onclick();
image.onload();
assert.equal(context.game.imageLoading,false);
assert.ok(answers.every(a=>!a.disabled));
context.game = {current:{pokemonName:true,answer:1}};
context.renderPokemonQuestionImage();
const staleLoad = image.onload;
context.game = null;
staleLoad();
console.log('PASS: image loading locks answers, failed image retry, successful unlock and stale callback after exit.');
