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
  id: 'bayesian-evaluation-case',
  domain: 'probabilistic-inference',
  adversarial: true,
  task: {
    id: 'bayesian-evaluation-task',
    description: 'Calculate a Bayesian posterior probability'
  },
  input: {
    observation: 'wet',
    hypotheses: [
      { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
      { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
    ]
  },
  expected: (report) => (
    report.strategy.representation === 'probabilistic-inference'
    && report.result.mostLikely === 'rain'
    && report.result.posterior.length === 2
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'bayesian-kernel',
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
  assert.equal(report.results[0].verifierId, 'bayesian-inference-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_BAYESIAN_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
