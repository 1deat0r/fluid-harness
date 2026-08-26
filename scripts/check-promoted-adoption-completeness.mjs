import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';

const cases = [1, 2].map((number) => new EvaluationCase({
  id: `promoted-adoption-completeness-${number}`,
  domain: 'graph',
  adversarial: true,
  task: {
    id: `promoted-adoption-completeness-${number}-task`,
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
const candidate = new RepresentationCandidate({
  id: 'incomplete-production-candidate',
  selectorFactory: () => new HeuristicRepresentationSelector()
});
const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
});

assert.equal(report.complete, false);
assert.equal(report.results[0].production.complete, false);
assert.equal(report.results[0].research.complete, true);
assert.equal(report.results[0].skeptic.complete, true);
assert.equal(report.results[0].promoted, false);
assert.equal(report.promoted, null);
assert.throws(
  () => selectorFromPromotedSearch(report),
  /complete trusted search report/
);

console.log('FLUID_PROMOTED_ADOPTION_COMPLETENESS_OK');
