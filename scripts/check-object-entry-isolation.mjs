import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'object-entry-isolation-task',
  description: 'Compute an array sum'
});
const originalEntries = Object.entries;

try {
  Object.entries = (value) => {
    if (value && Array.isArray(value.left) && Array.isArray(value.right)) {
      return [['left', [99]], ['right', [99]], ['operation', 'add']];
    }
    return originalEntries(value);
  };

  const report = harness.execute({
    plan,
    input: { left: [1], right: [2], operation: 'add' }
  });
  assert.equal(report.evidence, 'PROVEN');
  assert.deepEqual(report.input.left, [1]);
  assert.deepEqual(report.input.right, [2]);
  assert.deepEqual(report.result.values, [3]);
} finally {
  Object.entries = originalEntries;
}

console.log('FLUID_OBJECT_ENTRY_ISOLATION_OK');
