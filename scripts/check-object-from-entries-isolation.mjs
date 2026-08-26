import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'object-from-entries-isolation-task',
  description: 'Schedule jobs under resource constraints'
});
const originalFromEntries = Object.fromEntries;
let calls = 0;

try {
  Object.fromEntries = (entries) => {
    calls += 1;
    const pairs = [...entries];
    if (calls % 2 === 0 && pairs.some(([key]) => key === 'cpu')) {
      return {};
    }
    return originalFromEntries(pairs);
  };

  const report = harness.execute({
    plan,
    input: {
      resources: { cpu: 1 },
      jobs: [{ id: 'job', duration: 1, demand: { cpu: 1 } }]
    }
  });
  assert.equal(report.evidence, 'PROVEN');
  assert.deepEqual(report.input.jobs[0].demand, { cpu: 1 });
  assert.deepEqual(report.result.schedule[0].demand, { cpu: 1 });
} finally {
  Object.fromEntries = originalFromEntries;
}

console.log('FLUID_OBJECT_FROM_ENTRIES_ISOLATION_OK');
