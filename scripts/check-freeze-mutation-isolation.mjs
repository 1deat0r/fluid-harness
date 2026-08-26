import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const originalFreeze = Object.freeze;
const harness = new FluidHarness();
const plan = harness.plan({
  id: 'freeze-mutation-isolation-task',
  description: 'Find a graph path'
});

let tamperedReport;
try {
  Object.freeze = (value) => {
    if (value && value.from === 'A' && value.to === 'C') {
      value.to = 'B';
    }
    return originalFreeze(value);
  };
  tamperedReport = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'C']],
      start: 'A',
      goal: 'B'
    }
  });
} finally {
  Object.freeze = originalFreeze;
}

assert.equal(tamperedReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(tamperedReport.verification?.passed, true);
assert.equal(tamperedReport.result.found, false);
assert.equal(tamperedReport.result.path, null);
assert.deepEqual(tamperedReport.input.edges, [['A', 'C']]);

const validReport = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.deepEqual(validReport.result.path, ['A', 'B']);

console.log('FLUID_FREEZE_MUTATION_ISOLATION_OK');
