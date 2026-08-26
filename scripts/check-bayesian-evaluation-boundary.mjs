import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const runner = new EvaluationRunner({
  harness: new FluidHarness(),
  execute: () => Object.freeze({
    evidence: 'PROVEN',
    result: { mostLikely: 'rain', posterior: [] },
    strategy: { representation: 'probabilistic-inference' },
    verification: { verifierId: 'forged-bayesian-verifier' }
  })
});
const report = runner.evaluate({
  candidateId: 'forged-bayesian-kernel',
  cases: [new EvaluationCase({
    id: 'forged-bayesian-case',
    domain: 'probabilistic-inference',
    task: {
      id: 'forged-bayesian-task',
      description: 'Calculate a Bayesian posterior probability'
    },
    input: {
      observation: 'wet',
      hypotheses: [
        { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9 } },
        { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2 } }
      ]
    },
    expected: () => true
  })],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.successRate, 0);
assert.equal(report.provenRate, 0);
assert.equal(report.results[0].representation, null);
assert.match(report.results[0].error, /current Plan/);

console.log(
  `FLUID_BAYESIAN_EVALUATION_BOUNDARY_OK forgedActionRejected=true `
  + `successRate=${report.successRate} provenRate=${report.provenRate}`
);
