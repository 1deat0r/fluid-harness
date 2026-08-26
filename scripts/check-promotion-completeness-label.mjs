import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [1, 2].map((number) => new EvaluationCase({
  id: `promotion-completeness-label-${number}`,
  domain: 'graph',
  adversarial: true,
  task: {
    id: `promotion-completeness-label-${number}-task`,
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
}));
const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'partial-production-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
});

assert.equal(report.complete, false);
assert.equal(report.results[0].production.complete, false);
assert.equal(report.results[0].promoted, false);
assert.equal(report.promoted, null);

console.log('FLUID_PROMOTION_COMPLETENESS_LABEL_OK');
