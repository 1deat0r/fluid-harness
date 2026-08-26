import assert from 'node:assert/strict';

import { ActionReport } from '../src/action.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { GraphPathExecutor } from '../src/executor.mjs';
import { FluidHarness, isTrustedActionReport } from '../src/harness.mjs';
import { verifyGraphExecution } from '../src/verification.mjs';
import { Observation, SURPRISE_BANDS } from '../src/world-model.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'action-report-verification-binding',
  description: 'Find a graph path'
});
const trusted = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const sourceInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const execution = new GraphPathExecutor().execute({
  task: plan.task,
  strategy: plan.strategy,
  input: sourceInput,
  executionOptions: {}
});
const verification = verifyGraphExecution(execution);

const borrowed = new ActionReport({
  task: plan.task,
  strategy: plan.strategy,
  prediction: plan.prediction,
  observation: new Observation({ actualObservation: trusted.observation.actualObservation }),
  input: {
    nodes: ['X', 'Y'],
    edges: [],
    start: 'X',
    goal: 'Y'
  },
  result: execution.result,
  signal: {
    predictionError: false,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW
  },
  verification,
  verificationExecution: execution
});
assert.equal(borrowed.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(borrowed.verification, null);
assert.equal(isTrustedActionReport(borrowed), false);

const valid = new ActionReport({
  task: plan.task,
  strategy: plan.strategy,
  prediction: plan.prediction,
  observation: new Observation({ actualObservation: execution.observation }),
  input: sourceInput,
  result: execution.result,
  signal: {
    predictionError: false,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW
  },
  verification,
  verificationExecution: execution
});
assert.equal(valid.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(trusted.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_ACTION_REPORT_VERIFICATION_BINDING_OK');
