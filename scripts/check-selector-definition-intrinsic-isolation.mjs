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
  id: 'selector-definition-intrinsic-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'selector-definition-intrinsic-isolation-task',
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
const candidate = new RepresentationCandidate({
  id: 'selector-definition-intrinsic-isolation-candidate',
  selectorFactory: () => {
    Function.prototype.toString = () => 'spoofed-selector-definition';
    return { select: function stableSelector() { return REPRESENTATIONS.GRAPH; } };
  }
});

const originalToString = Function.prototype.toString;
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
  Function.prototype.toString = originalToString;
}

assert.equal(report.complete, true);
assert.equal(report.promoted?.candidateId, candidate.id);
assert.match(report.results[0].definitionFingerprint, /function stableSelector/);
assert.doesNotMatch(report.results[0].definitionFingerprint, /spoofed-selector-definition/);

console.log('FLUID_SELECTOR_DEFINITION_INTRINSIC_ISOLATION_OK');
