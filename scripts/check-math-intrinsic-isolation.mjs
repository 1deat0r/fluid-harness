import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'math-intrinsic-isolation-task',
  description: 'Schedule jobs under resource constraints'
});
const originalMax = Math.max;

try {
  Math.max = () => 999;
  const report = harness.execute({
    plan,
    input: {
      resources: { cpu: 1 },
      jobs: [{ id: 'job', duration: 1, demand: { cpu: 1 } }]
    }
  });
  assert.equal(report.evidence, 'PROVEN');
  assert.equal(report.result.makespan, 1);
  assert.equal(report.verification.passed, true);
  assert.equal(report.verification.checks.every(({ passed }) => passed), true);
} finally {
  Math.max = originalMax;
}

console.log('FLUID_MATH_INTRINSIC_ISOLATION_OK');
