import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  REPRESENTATIONS
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';

let factoryCalls = 0;
const candidate = new RepresentationCandidate({
  id: 'adoption-revalidation-candidate',
  selectorFactory: () => {
    factoryCalls += 1;
    const callNumber = factoryCalls;
    return {
      select: () => callNumber <= 3
        ? REPRESENTATIONS.GRAPH
        : REPRESENTATIONS.NATURAL_LANGUAGE
    };
  }
});
const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases: [new EvaluationCase({
    id: 'adoption-revalidation-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adoption-revalidation-task', description: 'Find a graph path' },
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

assert.equal(report.complete, true);
assert.equal(report.promoted.candidateId, candidate.id);
assert.equal(factoryCalls, 3);
assert.throws(
  () => selectorFromPromotedSearch(report),
  /revalidation|production evidence/i
);

console.log('FLUID_SELECTOR_ADOPTION_REVALIDATION_OK');
