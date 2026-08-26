import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { FluidHarness, isTrustedPlan, Plan } from '../src/harness.mjs';

const harness = new FluidHarness();
const trustedPlan = harness.plan({ id: 'trusted-plan-boundary', description: 'Find a graph path' });
const forgedPlan = new Plan({
  task: trustedPlan.task,
  strategy: trustedPlan.strategy,
  prediction: trustedPlan.prediction,
  strategyProfile: trustedPlan.strategyProfile
});
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

assert.equal(isTrustedPlan(trustedPlan), true);
assert.equal(isTrustedPlan(forgedPlan), false);
assert.throws(() => harness.execute({ plan: forgedPlan, input }), /trusted Plan/);
assert.throws(() => new ConstitutionalCore().execute({ plan: forgedPlan, input }), /trusted Plan/);
console.log('FLUID_PLAN_BOUNDARY_OK');
