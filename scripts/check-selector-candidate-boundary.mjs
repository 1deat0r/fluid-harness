import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  HeuristicRepresentationSelector,
  REPRESENTATIONS
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const sharedSelector = new HeuristicRepresentationSelector();
let firstCandidateCalls = 0;
let secondCandidateCalls = 0;
const freshSelector = () => ({ select: () => REPRESENTATIONS.GRAPH });
const budget = new EvaluationBudget({ maxCases: 1 });
const report = new RepresentationSearchRunner().evaluate({
  candidates: [
    new RepresentationCandidate({
      id: 'first-selector-candidate',
      selectorFactory: () => {
        firstCandidateCalls += 1;
        return firstCandidateCalls === 1 ? sharedSelector : freshSelector();
      }
    }),
    new RepresentationCandidate({
      id: 'second-selector-candidate',
      selectorFactory: () => {
        secondCandidateCalls += 1;
        return secondCandidateCalls === 1 ? sharedSelector : freshSelector();
      }
    })
  ],
  cases: [new EvaluationCase({
    id: 'selector-candidate-boundary-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'selector-candidate-boundary-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
  })],
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});

assert.equal(report.results[0].error, null);
assert.equal(report.results[1].production, null);
assert.match(report.results[1].error, /fresh selector/);

console.log('FLUID_SELECTOR_CANDIDATE_BOUNDARY_OK');
