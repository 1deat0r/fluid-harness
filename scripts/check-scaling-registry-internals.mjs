import assert from 'node:assert/strict';

import {
  EvaluationCase,
  POLICY_MODES
} from '../src/evaluation.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import { ScalingRunner } from '../src/scaling.mjs';
import {
  VerifierRegistry,
  verifyGraphExecution
} from '../src/verification.mjs';

const evaluationCase = new EvaluationCase({
  id: 'scaling-registry-internals-boundary',
  domain: 'scaling',
  task: { id: 'scaling-registry-internals-boundary-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const levels = [
  { id: 'internals-one', computeUnits: 1 },
  { id: 'internals-two', computeUnits: 2 }
];
const sharedExecutor = new GraphPathExecutor();
assert.throws(
  () => new ScalingRunner({
    harnessFactory: () => new FluidHarness({
      executorRegistry: new ExecutorRegistry({ executors: [sharedExecutor] })
    })
  }).evaluate({ cases: [evaluationCase], mode: POLICY_MODES.RESEARCH, levels }),
  /registry internals/
);

const sharedVerifier = (execution, options) => verifyGraphExecution(execution, options);
assert.throws(
  () => new ScalingRunner({
    harnessFactory: () => new FluidHarness({
      verifierRegistry: new VerifierRegistry({
        verifiers: [{ representation: REPRESENTATIONS.GRAPH, verify: sharedVerifier }]
      })
    })
  }).evaluate({ cases: [evaluationCase], mode: POLICY_MODES.RESEARCH, levels }),
  /registry internals/
);

const valid = new ScalingRunner().evaluate({
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  levels
});
assert.equal(valid.points.length, 2);

console.log('FLUID_SCALING_REGISTRY_INTERNALS_OK');
