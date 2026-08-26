import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  HeuristicRepresentationSelector
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'shared-selector-boundary',
    selector: new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'shared-selector-boundary-case',
    domain: 'graph',
    task: { id: 'shared-selector-boundary-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.promoted, null);
assert.equal(report.results[0].research, null);
assert.match(report.results[0].error, /fresh selector/);

console.log('FLUID_SELECTOR_FRESHNESS_OK');
