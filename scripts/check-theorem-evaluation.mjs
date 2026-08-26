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
  id: 'theorem-evaluation-case',
  domain: 'formal-reasoning',
  adversarial: true,
  task: {
    id: 'theorem-evaluation-task',
    description: 'Prove a formal theorem from assumptions'
  },
  input: {
    variables: ['p', 'q'],
    assumptions: [
      { op: 'implies', left: { op: 'var', name: 'p' }, right: { op: 'var', name: 'q' } },
      { op: 'var', name: 'p' }
    ],
    conclusion: { op: 'var', name: 'q' }
  },
  expected: (report) => (
    report.strategy.representation === 'theorem'
    && report.result.proved === true
    && report.result.counterexample === null
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'theorem-kernel',
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
  assert.equal(report.results[0].verifierId, 'theorem-prover-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_THEOREM_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
