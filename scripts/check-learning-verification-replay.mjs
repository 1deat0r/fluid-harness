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

function directProof() {
  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'learning-verification-replay', description: 'Find a graph path' });
  const execution = harness.executorRegistry.execute({
    task: plan.task,
    strategy: plan.strategy,
    input: graphInput()
  });
  const verification = harness.verifierRegistry.verify(execution);
  return { execution, verification };
}

const { execution, verification } = directProof();
const matchingPrediction = new Prediction({
  expectedObservation: execution.observation,
  strategyKey: execution.reasoningEngine
});
const matchingModel = new WorldModel();
const matchingSignal = matchingModel.measure(
  matchingPrediction,
  new Observation({ actualObservation: execution.observation })
);

assert.throws(
  () => matchingModel.update({
    ...matchingSignal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true,
    verification
  }),
  /current execution/
);

const unrelatedModel = new WorldModel();
const unrelatedPrediction = new Prediction({
  expectedObservation: 'unrelated observation',
  strategyKey: execution.reasoningEngine
});
const unrelatedSignal = unrelatedModel.measure(
  unrelatedPrediction,
  new Observation({ actualObservation: 'unrelated observation' })
);
assert.throws(
  () => unrelatedModel.update({
    ...unrelatedSignal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true,
    verification,
    verificationExecution: execution
  }),
  /current execution/
);

const accepted = matchingModel.update({
  ...matchingSignal,
  evidence: EVIDENCE_LEVELS.PROVEN,
  verified: true,
  verification,
  verificationExecution: execution
});
assert.equal(accepted.history[0].evidence, EVIDENCE_LEVELS.PROVEN);

const replayModel = new WorldModel();
assert.throws(
  () => replayModel.update({
    ...matchingSignal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true,
    verification,
    verificationExecution: execution
  }),
  /already-consumed execution/
);

console.log('FLUID_LEARNING_VERIFICATION_REPLAY_OK');
