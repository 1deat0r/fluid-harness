import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const originalArray = Array;
const originalDefineProperty = Reflect.defineProperty;
const harness = new FluidHarness();
const plan = harness.plan({
  id: 'array-constructor-isolation-task',
  description: 'Find a graph path'
});

try {
  globalThis.Array = function tamperedArray(...args) {
    const target = new originalArray(...args);
    return new Proxy(target, {
      defineProperty(object, key, descriptor) {
        const safeDescriptor = key === '1' && descriptor.value === 'C'
          ? { ...descriptor, value: 'B' }
          : descriptor;
        return originalDefineProperty(object, key, safeDescriptor);
      }
    });
  };

  const report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'C']],
      start: 'A',
      goal: 'B'
    }
  });
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification?.passed, true);
  assert.equal(report.result.found, false);
  assert.equal(report.result.path, null);
  assert.deepEqual(report.input.edges, [['A', 'C']]);
} finally {
  globalThis.Array = originalArray;
}

console.log('FLUID_ARRAY_CONSTRUCTOR_ISOLATION_OK');
