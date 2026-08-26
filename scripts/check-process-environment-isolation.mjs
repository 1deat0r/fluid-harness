import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const originalProcess = globalThis.process;
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

const baselineHarness = new FluidHarness();
const baselinePlan = baselineHarness.plan({
  id: 'process-environment-isolation-baseline',
  description: 'Find a graph path'
});
const baseline = baselineHarness.execute({ plan: baselinePlan, input });

try {
  globalThis.process = {
    version: 'tampered-node',
    platform: 'tampered-platform',
    arch: 'tampered-architecture'
  };
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'process-environment-isolation-tampered',
    description: 'Find a graph path'
  });
  const report = harness.execute({ plan, input });
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.environmentHash, baseline.environmentHash);
} finally {
  globalThis.process = originalProcess;
}

console.log('FLUID_PROCESS_ENVIRONMENT_ISOLATION_OK');
