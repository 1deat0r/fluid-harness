import assert from 'node:assert/strict';

import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const cases = [new EvaluationCase({
  id: 'locale-compare-intrinsic-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'locale-compare-intrinsic-isolation-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.result?.path?.join('>') === 'A>B'
})];

function candidate(id) {
  return new RepresentationCandidate({
    id,
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  });
}

const originalLocaleCompare = String.prototype.localeCompare;
let report;
try {
  String.prototype.localeCompare = () => 1;
  report = new RepresentationSearchRunner().evaluate({
    candidates: [candidate('candidate-b'), candidate('candidate-a')],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
} finally {
  String.prototype.localeCompare = originalLocaleCompare;
}

assert.equal(report.complete, true);
assert.equal(report.winner.candidateId, 'candidate-a');
assert.equal(report.promoted?.candidateId, 'candidate-a');
assert.deepEqual(
  report.results.map(({ candidateId }) => candidateId),
  ['candidate-a', 'candidate-b']
);

console.log('FLUID_LOCALE_COMPARE_INTRINSIC_ISOLATION_OK');
