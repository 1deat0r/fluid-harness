import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  EXECUTION_SUBSTRATES,
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'bayesian-check',
  description: 'Calculate a Bayesian posterior probability'
});
const report = harness.execute({
  plan,
  input: {
    observation: 'wet',
    hypotheses: [
      { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
      { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
    ]
  },
  reproduction: 'node scripts/check-bayesian.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.PROBABILISTIC_INFERENCE);
assert.equal(plan.strategy.reasoningEngine, REASONING_ENGINES.BAYESIAN_INFERENCE);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.DETERMINISTIC_KERNEL);
assert.equal(report.result.mostLikely, 'rain');
assert.equal(report.result.hypothesisCount, 2);
assert.equal(report.result.posterior.length, 2);
assert.ok(Math.abs(report.result.posterior[0].probability - 0.5294117647058824) < 1e-12);
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'bayesian-inference-verifier/v1');
assert.equal(report.verification.passed, true);

console.log(
  `FLUID_BAYESIAN_OK representation=${plan.strategy.representation} `
  + `mostLikely=${report.result.mostLikely} hypotheses=${report.result.hypothesisCount} `
  + `evidence=${report.evidence} verifier=${report.verification.verifierId}`
);
