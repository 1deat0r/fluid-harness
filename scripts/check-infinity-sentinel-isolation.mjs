import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const originalNumber = Number;
const tamperedNumber = (...args) => originalNumber(...args);
tamperedNumber.POSITIVE_INFINITY = 1;

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'infinity-sentinel-isolation-task',
  description: 'Find a graph path'
});

try {
  globalThis.Number = tamperedNumber;
  const report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.result.found, true);
  assert.equal(report.result.searchComplete, true);
  assert.deepEqual(report.result.path, ['A', 'B']);
} finally {
  globalThis.Number = originalNumber;
}

console.log('FLUID_INFINITY_SENTINEL_ISOLATION_OK');
