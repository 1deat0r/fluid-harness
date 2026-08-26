import assert from 'node:assert/strict';

import { EvaluationCase, POLICY_MODES } from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { ScalingRunner } from '../src/scaling.mjs';

const sharedHarness = new FluidHarness();
const evaluationCase = new EvaluationCase({
  id: 'scaling-isolation-boundary',
  domain: 'scaling',
  task: { id: 'scaling-isolation-boundary-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});

assert.throws(
  () => new ScalingRunner({ harnessFactory: () => sharedHarness }).evaluate({
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    levels: [
      { id: 'scaling-isolation-one', computeUnits: 1 },
      { id: 'scaling-isolation-two', computeUnits: 2 }
    ]
  }),
  /fresh harness/
);

console.log('FLUID_SCALING_ISOLATION_OK');
