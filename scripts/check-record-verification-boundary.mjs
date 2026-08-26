import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const verifiedPlan = harness.plan({
  id: 'record-verification-source',
  description: 'Find a graph path'
});
const verified = harness.execute({
  plan: verifiedPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const manualPlan = harness.plan({
  id: 'record-verification-replay',
  description: 'Describe an ambiguous requirement'
});
assert.throws(
  () => harness.record({
    plan: manualPlan,
    actualObservation: 'not checked',
    result: 'claimed success',
    verification: verified.verification
  }),
  /manual record cannot accept a trusted verification/
);

const observed = harness.record({
  plan: manualPlan,
  actualObservation: 'not checked',
  result: 'caller observation'
});
assert.equal(observed.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(observed.verification, null);

console.log('FLUID_RECORD_VERIFICATION_BOUNDARY_OK');
