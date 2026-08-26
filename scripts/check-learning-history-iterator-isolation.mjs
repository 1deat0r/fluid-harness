import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'learning-history-iterator-isolation-task',
  description: 'Find a graph path'
});
core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const expectedHistory = core.learningHistory;
const originalIterator = Array.prototype[Symbol.iterator];
try {
  Array.prototype[Symbol.iterator] = function emptyIterator() {
    return originalIterator.call([]);
  };
  assert.equal(core.learningHistory.length, expectedHistory.length);
  assert.equal(core.learningHistory[0].strategyKey, expectedHistory[0].strategyKey);
} finally {
  Array.prototype[Symbol.iterator] = originalIterator;
}

console.log('FLUID_LEARNING_HISTORY_ITERATOR_ISOLATION_OK');
