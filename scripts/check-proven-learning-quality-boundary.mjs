import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  Observation,
  Prediction,
  WorldModel
} from '../src/world-model.mjs';

function graphInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

function recordAsProven(model, execution, verification) {
  const prediction = new Prediction({
    expectedObservation: execution.observation,
    strategyKey: execution.reasoningEngine
  });
  const signal = model.measure(
    prediction,
    new Observation({ actualObservation: execution.observation })
  );
  return model.update({
    ...signal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true,
    verification,
    verificationExecution: execution
  });
}

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'proven-learning-quality-boundary',
  description: 'Find a graph path'
});

const limitedExecution = harness.executorRegistry.execute({
  task: plan.task,
  strategy: plan.strategy,
  input: graphInput(),
  executionOptions: { maxExpansions: 1 }
});
const limitedVerification = harness.verifierRegistry.verify(limitedExecution);
assert.equal(limitedVerification.passed, false);
assert.equal(limitedVerification.deterministic, true);
assert.throws(
  () => recordAsProven(new WorldModel(), limitedExecution, limitedVerification),
  /passing deterministic verification/
);

const provenExecution = harness.executorRegistry.execute({
  task: plan.task,
  strategy: plan.strategy,
  input: graphInput()
});
const provenVerification = harness.verifierRegistry.verify(provenExecution);
assert.equal(provenVerification.passed, true);
const accepted = recordAsProven(new WorldModel(), provenExecution, provenVerification);
assert.equal(accepted.history[0].evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_PROVEN_LEARNING_QUALITY_BOUNDARY_OK');
