import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const evaluationCase = new EvaluationCase({
  id: 'search-tree-evaluation-case',
  domain: 'search-tree',
  adversarial: true,
  task: {
    id: 'search-tree-evaluation-task',
    description: 'Explore a finite search tree of candidate branches'
  },
  input: {
    root: 'root',
    objective: 'minimize',
    nodes: [
      { id: 'root', terminal: false },
      { id: 'slow', terminal: true, value: 9 },
      { id: 'fast', terminal: true, value: 2 }
    ],
    edges: [
      { from: 'root', to: 'slow' },
      { from: 'root', to: 'fast' }
    ]
  },
  expected: (report) => (
    report.strategy.representation === 'search-tree'
    && report.result.selectedId === 'fast'
    && report.result.selectedValue === 2
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'search-tree-kernel',
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
}

const production = evaluate(POLICY_MODES.PRODUCTION);
const research = evaluate(POLICY_MODES.RESEARCH);
const skeptic = evaluate(POLICY_MODES.SKEPTIC);
for (const report of [production, research, skeptic]) {
  assert.equal(report.complete, true);
  assert.equal(report.successRate, 1);
  assert.equal(report.provenRate, 1);
  assert.equal(report.results[0].verifierId, 'finite-search-tree-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_SEARCH_TREE_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
