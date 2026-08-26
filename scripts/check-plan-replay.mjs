import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { FluidHarness, isTrustedPlan } from '../src/harness.mjs';

const donor = new FluidHarness();
const donorPlan = donor.plan({ id: 'donor-plan-boundary', description: 'Find a graph path' });
const harness = new FluidHarness();
const core = new ConstitutionalCore({ harness });
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

assert.equal(isTrustedPlan(donorPlan, donor), true);
assert.equal(isTrustedPlan(donorPlan, harness), false);
assert.throws(
  () => harness.execute({ plan: donorPlan, input }),
  /trusted Plan/
);
assert.throws(
  () => core.execute({ plan: donorPlan, input }),
  /trusted Plan/
);

console.log('FLUID_PLAN_REPLAY_OK');
