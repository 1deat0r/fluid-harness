import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const manualPlan = harness.plan({
  id: 'manual-observation',
  description: 'Explain an ambiguous requirement'
});
const forged = harness.record({
  plan: manualPlan,
  actualObservation: 'the executor was never called',
  result: 'claimed success',
  verification: { passed: true, deterministic: true }
});

assert.notEqual(forged.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(forged.verification, null);
assert.equal(forged.environmentHash, null);

const graphPlan = harness.plan({
  id: 'verified-graph',
  description: 'Find the shortest path through a dependency graph'
});
const verified = harness.execute({
  plan: graphPlan,
  input: {
    nodes: ['A', 'B', 'D'],
    edges: [['A', 'B'], ['B', 'D']],
    start: 'A',
    goal: 'D'
  }
});

assert.equal(verified.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(verified.verification.verifierId, 'graph-path-verifier/v1');
assert.match(verified.environmentHash, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(verified.result.path, ['A', 'B', 'D']);
console.log('FLUID_EVIDENCE_BOUNDARY_OK');
