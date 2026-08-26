import assert from 'node:assert/strict';

import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';

let factoryCalls = 0;
const candidate = new RepresentationCandidate({
  id: 'adoption-research-boundary-candidate',
  selectorFactory: () => {
    factoryCalls += 1;
    if (factoryCalls <= 3) {
      return new HeuristicRepresentationSelector();
    }
    return { select: () => 'graph' };
  }
});

const cases = [
  new EvaluationCase({
    id: 'adoption-research-production-case',
    domain: 'graph',
    task: { id: 'adoption-research-production-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.path?.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'adoption-research-adversarial-case',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: {
      id: 'adoption-research-adversarial-task',
      description: 'Safely handle an unsupported request'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (_report, error) => error?.message.includes('No executor')
  })
];

const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.complete, true);
assert.equal(report.promoted?.candidateId, candidate.id);
assert.equal(factoryCalls, 3);
assert.throws(
  () => selectorFromPromotedSearch(report),
  /research evidence revalidation/i
);
assert.equal(factoryCalls, 4);

console.log('FLUID_SELECTOR_ADOPTION_RESEARCH_BOUNDARY_OK');
