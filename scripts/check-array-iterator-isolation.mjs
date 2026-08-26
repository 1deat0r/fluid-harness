import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'array-iterator-isolation-task',
  description: 'Find a graph path'
});
const originalIterator = Array.prototype[Symbol.iterator];
let report;
try {
  Array.prototype[Symbol.iterator] = function selectiveIterator() {
    if (this.length === 1 && this[0]?.from === 'A' && this[0]?.to === 'B') {
      return originalIterator.call([]);
    }
    return originalIterator.call(this);
  };
  report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });
} finally {
  Array.prototype[Symbol.iterator] = originalIterator;
}

assert.equal(report.evidence, 'PROVEN');
assert.deepEqual(report.result.path, ['A', 'B']);
assert.equal(report.verification?.passed, true);
assert.deepEqual(report.input.edges, [['A', 'B']]);

console.log('FLUID_ARRAY_ITERATOR_ISOLATION_OK');
