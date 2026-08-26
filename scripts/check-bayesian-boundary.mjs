import assert from 'node:assert/strict';

import {
  BayesianInferenceExecutor,
  createExecutionResult,
  ExecutorRegistry
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyBayesianExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.PROBABILISTIC_INFERENCE,
  reasoningEngine: REASONING_ENGINES.BAYESIAN_INFERENCE
};
const task = { id: 'bayesian-boundary-task' };
const validInput = {
  observation: 'wet',
  hypotheses: [
    { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
    { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
  ]
};
const executor = new BayesianInferenceExecutor();

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({ ...validInput, hypotheses: [
    { id: 'rain', prior: -0.1, likelihoods: { wet: 0.9, dry: 0.1 } },
    { id: 'clear', prior: 1.1, likelihoods: { wet: 0.2, dry: 0.8 } }
  ] }),
  /probability between 0 and 1/
);
assert.throws(
  () => execute({ ...validInput, hypotheses: [
    { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9 } },
    { id: 'clear', prior: 0.7, likelihoods: { wet: 0.2 } }
  ] }),
  /sum to 1/
);
assert.throws(
  () => execute({ ...validInput, hypotheses: [
    { id: 'rain', prior: 0.2, likelihoods: { dry: 1 } },
    { id: 'clear', prior: 0.8, likelihoods: { dry: 1 } }
  ] }),
  /include the observation/
);
assert.throws(
  () => execute({ ...validInput, hypotheses: [
    { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.2 } },
    { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
  ] }),
  /Bayesian likelihoods for rain must sum to 1/
);
assert.throws(
  () => execute({ ...validInput, hypotheses: [
    { id: 'same', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
    { id: 'same', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
  ] }),
  /Duplicate Bayesian hypothesis id/
);
assert.throws(
  () => execute({
    observation: 'wet',
    hypotheses: [
      { id: 'rain', prior: 1, likelihoods: { wet: 0, dry: 1 } }
    ]
  }),
  /non-zero probability/
);
assert.throws(
  () => execute({
    observation: 'wet',
    hypotheses: Array.from({ length: 33 }, (_, index) => ({
      id: `h${index}`,
      prior: index === 0 ? 1 : 0,
      likelihoods: { wet: 1 }
    }))
  }),
  /1-32 entries/
);

const honest = execute(validInput);
assert.equal(verifyBayesianExecution(honest).passed, true);
assert.throws(
  () => verifyBayesianExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedBayesianExecutor extends BayesianInferenceExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        mostLikely: 'clear'
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new ForgedBayesianExecutor()] })
});
const forgedPlan = forgedHarness.plan({
  id: 'bayesian-forged-result',
  description: 'Calculate a Bayesian posterior probability'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: validInput
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, 'PROVEN');

console.log(
  `FLUID_BAYESIAN_BOUNDARY_OK malformedRejected=true distributionRejected=true zeroEvidenceRejected=true `
  + `untrustedRejected=true forgedPosteriorRejected=true evidence=${forgedReport.evidence}`
);
