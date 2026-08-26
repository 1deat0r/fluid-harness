import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'action-report-deep-immutability-plan',
  description: 'Find a graph path'
});
const nestedResult = { count: 1 };
const result = Object.freeze({ metadata: nestedResult });
const report = harness.record({
  plan,
  actualObservation: 'graph path resolved',
  result
});

assert.equal(Object.isFrozen(report.result), true);
assert.equal(Object.isFrozen(report.result.metadata), true);
assert.throws(
  () => {
    nestedResult.count = 2;
  },
  TypeError
);
assert.equal(report.result.metadata.count, 1);

console.log('FLUID_ACTION_REPORT_DEEP_IMMUTABILITY_OK');
