import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  ArrayComputationExecutor,
  ConstraintScheduleExecutor,
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  CognitiveCycleRunner
} from '../src/cycle.mjs';
import { EvolutionAuthority } from '../src/evolution.mjs';
import {
  HeuristicRepresentationSelector,
  REPRESENTATIONS,
  RepresentationSelection
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { ScalingRunner } from '../src/scaling.mjs';
import { VerifierRegistry } from '../src/verification.mjs';
import { WorldModel } from '../src/world-model.mjs';

for (const prototype of [
  FluidHarness.prototype,
  CognitiveCycleRunner.prototype,
  EvolutionAuthority.prototype,
  ScalingRunner.prototype,
  HeuristicRepresentationSelector.prototype,
  RepresentationCandidate.prototype,
  GraphPathExecutor.prototype,
  ConstraintScheduleExecutor.prototype,
  ArrayComputationExecutor.prototype,
  ExecutorRegistry.prototype,
  VerifierRegistry.prototype,
  WorldModel.prototype
]) {
  assert.equal(Object.isFrozen(prototype), true);
}

const originalSelect = HeuristicRepresentationSelector.prototype.select;
const originalSelectDescriptor = Object.getOwnPropertyDescriptor(
  HeuristicRepresentationSelector.prototype,
  'select'
);
let patchError = null;
const cases = [
  new EvaluationCase({
    id: 'cross-candidate-prototype-graph',
    domain: 'graph',
    adversarial: true,
    task: { id: 'cross-candidate-prototype-graph-task', description: 'Find a graph path' },
    input: { nodes: ['A', 'B'], edges: [['A', 'B']], start: 'A', goal: 'B' },
    expected: (report) => report?.result?.path?.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'cross-candidate-prototype-constraint',
    domain: 'constraints',
    adversarial: true,
    task: {
      id: 'cross-candidate-prototype-constraint-task',
      description: 'Schedule jobs under resource constraints'
    },
    input: {
      resources: { cpu: 1 },
      jobs: [{ id: 'job', duration: 1, demand: { cpu: 1 } }]
    },
    expected: (report) => report?.result?.makespan === 1
  })
];

let report;
try {
  report = new RepresentationSearchRunner().evaluate({
    candidates: [
      new RepresentationCandidate({
        id: 'cross-candidate-prototype-attacker',
        selectorFactory: () => {
          try {
            HeuristicRepresentationSelector.prototype.select = () => new RepresentationSelection({
              representation: REPRESENTATIONS.GRAPH,
              confidence: 1,
              ambiguous: false,
              candidates: []
            });
          } catch (error) {
            patchError = error;
            throw error;
          }
          return new HeuristicRepresentationSelector();
        }
      }),
      new RepresentationCandidate({
        id: 'cross-candidate-prototype-victim',
        selectorFactory: () => new HeuristicRepresentationSelector()
      })
    ],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: cases.length }),
    researchBudget: new EvaluationBudget({ maxCases: cases.length }),
    skepticBudget: new EvaluationBudget({ maxCases: cases.length })
  });
} finally {
  if (HeuristicRepresentationSelector.prototype.select !== originalSelect) {
    Object.defineProperty(
      HeuristicRepresentationSelector.prototype,
      'select',
      originalSelectDescriptor
    );
  }
}

assert.equal(HeuristicRepresentationSelector.prototype.select, originalSelect);
assert.equal(patchError instanceof TypeError, true);
assert.match(patchError.message, /Cannot assign|read only|frozen|non-configurable/i);
const attackerResult = report.results.find(
  ({ candidateId }) => candidateId === 'cross-candidate-prototype-attacker'
);
assert.equal(attackerResult.promoted, false);
assert.equal(attackerResult.error !== null, true);
assert.equal(report.complete, false);
assert.match(attackerResult.error, /Cannot assign|read only|frozen|non-configurable/i);

console.log('FLUID_CROSS_CANDIDATE_PROTOTYPE_BOUNDARY_OK');
