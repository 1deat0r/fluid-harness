import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const task = { id: 'planning-boundary', description: 'Find a graph path' };
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

const firstPlan = harness.plan(task);
assert.equal(firstPlan.strategyProfile.attempts, 0);
assert.equal(Object.isFrozen(firstPlan.strategyProfile), true);
const first = harness.execute({ plan: firstPlan, input });

const secondPlan = harness.plan(task);
assert.equal(secondPlan.strategyProfile.attempts, 1);
assert.ok(secondPlan.prediction.expectedLikelihood > first.prediction.expectedLikelihood);
const second = harness.execute({ plan: secondPlan, input });

assert.equal(first.priorStrategyProfile.attempts, 0);
assert.equal(second.priorStrategyProfile.attempts, 1);
assert.equal(second.strategyProfile.attempts, 2);
assert.equal(Object.isFrozen(second.priorStrategyProfile), true);
console.log(`FLUID_PLANNING_BOUNDARY_OK prior=0,1 final=${second.strategyProfile.attempts} likelihood=${secondPlan.prediction.expectedLikelihood}`);
