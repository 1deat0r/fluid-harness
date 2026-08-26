import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { isFrozenObject } from '../src/intrinsics.mjs';

const originalWeakMap = WeakMap;
const originalWeakSet = WeakSet;

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'weak-constructor-isolation-task',
  description: 'Find a graph path'
});
const input = {
  nodes: ['A', 'B', 'C'],
  edges: [['A', 'C']],
  start: 'A',
  goal: 'B'
};
const forgedSnapshot = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const sharedMap = new originalWeakMap();
sharedMap.set(input, forgedSnapshot);

try {
  globalThis.WeakMap = function tamperedWeakMap() {
    return sharedMap;
  };

  const report = harness.execute({ plan, input });
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification?.passed, true);
  assert.equal(report.result.found, false);
  assert.equal(report.result.path, null);
  assert.deepEqual(report.input.edges, [['A', 'C']]);
} finally {
  globalThis.WeakMap = originalWeakMap;
}

const shallowOuter = Object.freeze({ nested: { mutable: true } });
const sharedSet = new originalWeakSet([shallowOuter.nested]);
try {
  globalThis.WeakSet = function tamperedWeakSet() {
    return sharedSet;
  };
  assert.equal(isFrozenObject(shallowOuter), false);
} finally {
  globalThis.WeakSet = originalWeakSet;
}

console.log('FLUID_WEAK_CONSTRUCTOR_ISOLATION_OK');
