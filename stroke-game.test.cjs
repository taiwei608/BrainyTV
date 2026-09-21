const assert = require('node:assert/strict');
const game = require('./stroke-game.js');

const sample = {
  char: '永',
  strokes: ['a', 'same-shape', 'same-shape', 'd'],
  medians: [[[0, 0]], [[1, 1]], [[2, 2]], [[3, 3]]]
};

const options = game.buildOptions(sample, 1, 4);
assert.equal(options.filter(option => option.correct).length, 1, 'exactly one correct target');
assert.equal(new Set(options.map(option => option.strokeIndex)).size, options.length, 'option indexes are unique');
assert.notEqual(options.find(option => option.strokeIndex === 1).contextKey, options.find(option => option.strokeIndex === 2).contextKey, 'identical path shapes remain positionally distinct');
assert.equal(game.isTeachingStep(3, 4), true, 'final stroke is a teaching step');
assert.deepEqual(game.buildOptions(sample, 3, 4), [], 'teaching step has no fake choices');

const original = { cursor: 0, practiced: 0, stats: {} };
const a = game.recordAttempt(original, '永', 1, true);
const b = game.recordAttempt({ cursor: 2, practiced: 0, stats: {} }, '永', 1, false);
assert.deepEqual(a.stats['永']['1'], { attempts: 1, correct: 1, wrong: 0 });
assert.deepEqual(b.stats['永']['1'], { attempts: 1, correct: 0, wrong: 1 });
assert.equal(original.stats['永'], undefined, 'player records do not leak into each other');
assert.equal(game.advanceCursor(18, 5, 20), 3, 'progression wraps through the pilot set');
assert.deepEqual(game.chooseRound(['一', '二', '三'], 2, 2), ['三', '一']);

assert.equal(game.canAdvance('animating', 1000, 0), false, 'OK cannot advance while a stroke is animating');
assert.equal(game.canAdvance('ready', 1000, 1100), false, 'OK cannot double-activate during the unlock guard');
assert.equal(game.canAdvance('ready', 1200, 1100), true, 'OK advances only after feedback is ready');
assert.equal(game.canAdvance('demo-ready', 1200, 1100), true, 'demo replay activates when the full preview is ready');
assert.equal(game.resumeAction('play', 'animating'), 'replay-stroke', 'closing exit resumes interrupted feedback');
assert.equal(game.resumeAction('play', 'ready'), 'focus', 'closing exit preserves an already-ready next step');
assert.equal(game.resumeAction('demo', 'animating'), 'replay-demo', 'closing exit resumes an interrupted demo');
assert.equal(game.resumeAction('demo', 'demo-ready'), 'focus', 'completed demo keeps replay ready');

const migrated = game.normalizePilot({ practiced: 99, practicedChars: ['永', '永', '一'], stats: {} });
assert.deepEqual(migrated.practicedChars, ['永', '一'], 'practiced count is based on unique characters');

console.log('stroke-game tests passed');
