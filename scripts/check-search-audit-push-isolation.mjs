import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'search-audit-push-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'search-audit-push-isolation-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];

const originalPush = Array.prototype.push;
let patched = false;
const candidate = new RepresentationCandidate({
  id: 'search-audit-push-isolation-candidate',
  selectorFactory: () => ({
    select() {
      if (!patched) {
        patched = true;
        Array.prototype.push = () => 0;
      }
      return REPRESENTATIONS.GRAPH;
    }
  })
});

let report;
try {
  report = new RepresentationSearchRunner().evaluate({
    candidates: [candidate],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
} finally {
  Array.prototype.push = originalPush;
}

const result = report.results[0];
assert.equal(patched, true);
assert.equal(result.auditValid, true);
assert.equal(result.definitionFingerprint.split('\u0000').length, 3);
assert.equal(report.complete, true);
assert.equal(report.promoted?.candidateId, candidate.id);

console.log('FLUID_SEARCH_AUDIT_PUSH_ISOLATION_OK');
