import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { ScalingRunner } from '../src/scaling.mjs';
import { VerifierRegistry } from '../src/verification.mjs';
import { WorldModel } from '../src/world-model.mjs';

const evaluationCase = new EvaluationCase({
  id: 'scaling-dependency-isolation-case',
  domain: 'scaling',
  task: { id: 'scaling-dependency-isolation-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const budget = new EvaluationBudget({ maxCases: 1 });
const levels = [
  { id: 'dependency-one', computeUnits: 1 },
  { id: 'dependency-two', computeUnits: 2 }
];

const sharedDependencies = [
  ['selector', new HeuristicRepresentationSelector()],
  ['world model', new WorldModel()],
  ['executor registry', new ExecutorRegistry()],
  ['verifier registry', new VerifierRegistry()]
];

for (const [label, shared] of sharedDependencies) {
  assert.throws(
    () => new ScalingRunner({
      harnessFactory: () => new FluidHarness({
        selector: label === 'selector' ? shared : new HeuristicRepresentationSelector(),
        worldModel: label === 'world model' ? shared : new WorldModel(),
        executorRegistry: label === 'executor registry' ? shared : new ExecutorRegistry(),
        verifierRegistry: label === 'verifier registry' ? shared : new VerifierRegistry()
      })
    }).evaluate({
      candidateId: `shared-${label}`,
      cases: [evaluationCase],
      mode: POLICY_MODES.RESEARCH,
      levels,
      productionBudget: budget
    }),
    /fresh harness dependencies/
  );
}

const valid = new ScalingRunner().evaluate({
  candidateId: 'fresh-dependencies',
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  levels,
  productionBudget: budget
});
assert.equal(valid.points.length, 2);

console.log('FLUID_SCALING_DEPENDENCY_ISOLATION_OK');
