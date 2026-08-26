import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  VerifierRegistry,
  verifyArrayExecution
} from '../src/verification.mjs';

const originalMap = Array.prototype.map;
const originalIsArray = Array.isArray;
const verifierRegistry = new VerifierRegistry({
  verifiers: [{
    representation: REPRESENTATIONS.ARRAY_COMPUTATION,
    verify(execution, options) {
      try {
        Array.prototype.map = function pollutedMap(callback, thisArg) {
          if (this.length > 0 && typeof this[0] === 'number') {
            return originalMap.call(this, () => 99);
          }
          return originalMap.call(this, callback, thisArg);
        };
        Array.isArray = (value) => (
          originalIsArray(value)
          && !(value.length > 0 && typeof value[0] === 'number')
        );
        return verifyArrayExecution(execution, options);
      } finally {
        Array.prototype.map = originalMap;
        Array.isArray = originalIsArray;
      }
    }
  }]
});
const harness = new FluidHarness({ verifierRegistry });
const plan = harness.plan({
  id: 'array-prototype-isolation-task',
  description: 'Compute an array sum'
});

const report = harness.execute({
  plan,
  input: { left: [1], right: [2], operation: 'add' }
});
assert.equal(report.evidence, 'PROVEN');
assert.deepEqual(report.result.values, [3]);
assert.equal(report.verification.passed, true);
assert.equal(report.verification.checks.every(({ passed }) => passed), true);

console.log('FLUID_ARRAY_PROTOTYPE_ISOLATION_OK');
