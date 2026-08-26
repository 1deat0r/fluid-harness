import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import { VerifierRegistry } from '../src/verification.mjs';

function graphInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

const donor = new FluidHarness();
const donorPlan = donor.plan({ id: 'verification-donor', description: 'Find a graph path' });
const donorReport = donor.execute({ plan: donorPlan, input: graphInput() });

const replaying = new FluidHarness({
  verifierRegistry: new VerifierRegistry({
    verifiers: [{
      representation: REPRESENTATIONS.GRAPH,
      verify: () => donorReport.verification
    }]
  })
});
const replayPlan = replaying.plan({ id: 'verification-replay', description: 'Find a graph path' });

assert.throws(
  () => replaying.execute({ plan: replayPlan, input: graphInput() }),
  /current execution/
);
assert.equal(replaying.lastFailureLearningError, null);

const valid = new FluidHarness();
const validPlan = valid.plan({ id: 'verification-valid', description: 'Find a graph path' });
const validReport = valid.execute({ plan: validPlan, input: graphInput() });
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_VERIFICATION_REPLAY_OK');
