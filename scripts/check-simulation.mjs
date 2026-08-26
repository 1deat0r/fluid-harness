import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  EXECUTION_SUBSTRATES,
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';

const input = {
  states: ['idle', 'running', 'done'],
  initialState: 'idle',
  transitions: [
    { from: 'idle', event: 'start', to: 'running' },
    { from: 'running', event: 'finish', to: 'done' }
  ],
  events: ['start', 'finish']
};
const harness = new FluidHarness();
const plan = harness.plan({
  id: 'simulation-check',
  description: 'Simulate a finite state-machine scenario'
});
const report = harness.execute({
  plan,
  input,
  reproduction: 'node scripts/check-simulation.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.SIMULATION);
assert.equal(plan.strategy.reasoningEngine, REASONING_ENGINES.SIMULATION_ENGINE);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.DETERMINISTIC_KERNEL);
assert.deepEqual(report.result.trace, ['idle', 'running', 'done']);
assert.equal(report.result.finalState, 'done');
assert.equal(report.result.completed, true);
assert.equal(report.result.blockedAtStep, null);
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'finite-state-simulation-verifier/v1');
assert.equal(report.verification.passed, true);
assert.equal(report.surpriseBand, 'LOW');

const blockedHarness = new FluidHarness();
const blockedPlan = blockedHarness.plan({
  id: 'simulation-blocked-check',
  description: 'Simulate a finite state-machine scenario'
});
const blockedReport = blockedHarness.execute({
  plan: blockedPlan,
  input: { ...input, events: ['start', 'pause'] }
});
assert.equal(blockedReport.result.completed, false);
assert.equal(blockedReport.result.blockedAtStep, 1);
assert.equal(blockedReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log(
  `FLUID_SIMULATION_OK representation=${plan.strategy.representation} `
  + `finalState=${report.result.finalState} completed=${report.result.completed} `
  + `blockedProof=${!blockedReport.result.completed} evidence=${report.evidence} `
  + `verifier=${report.verification.verifierId}`
);
