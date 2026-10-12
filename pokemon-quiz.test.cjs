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
for (const name of ['questionWeight', 'generatePokemonQuestion', 'generateQuestion', 'shuffle', 'makeChoiceOptions', 'emptyRecord', 'createProgressMap', 'ensurePlayerProgress', 'playerRecord', 'selectedLevel']) include(name);
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
