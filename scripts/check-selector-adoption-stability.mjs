import assert from 'node:assert/strict';

import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';

const candidate = new RepresentationCandidate({
  id: 'adoption-stability-candidate',
  selectorFactory: () => {
    let selectCalls = 0;
    return {
      select() {
        selectCalls += 1;
        return selectCalls <= 2
          ? REPRESENTATIONS.GRAPH
          : REPRESENTATIONS.NATURAL_LANGUAGE;
      }
    };
  }
});

const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases: [new EvaluationCase({
    id: 'adoption-stability-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adoption-stability-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport?.result?.path?.join('>') === 'A>B'
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.complete, true);
assert.equal(report.promoted?.candidateId, candidate.id);
assert.throws(
  () => selectorFromPromotedSearch(report),
  /production stability replay/i
);

console.log('FLUID_SELECTOR_ADOPTION_STABILITY_OK');
