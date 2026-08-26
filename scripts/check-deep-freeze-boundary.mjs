import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  VerifierRegistry,
  verifyArrayExecution
} from '../src/verification.mjs';

const originalFreeze = Object.freeze;
const verifierRegistry = new VerifierRegistry({
  verifiers: [{
    representation: REPRESENTATIONS.ARRAY_COMPUTATION,
    verify(execution, options) {
      Object.freeze = (value) => {
        if (
          Array.isArray(value)
          && value.length > 0
          && value[0]?.id === 'execution-status'
        ) {
          return value;
        }
        return originalFreeze(value);
      };
      try {
        return verifyArrayExecution(execution, options);
      } finally {
        Object.freeze = originalFreeze;
      }
    }
  }]
});

const harness = new FluidHarness({ verifierRegistry });
const plan = harness.plan({
  id: 'deep-freeze-boundary-task',
  description: 'Compute an array sum'
});
const report = harness.execute({
  plan,
  input: { left: [1], right: [2], operation: 'add' }
});

assert.equal(report.evidence, 'PROVEN');
assert.equal(report.verification?.passed, true);

console.log('FLUID_DEEP_FREEZE_BOUNDARY_OK');
