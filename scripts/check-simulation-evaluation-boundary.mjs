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
    result: { completed: true, finalState: 'done' },
    strategy: { representation: 'simulation' },
    verification: { verifierId: 'forged-simulation-verifier' }
  })
});
const report = runner.evaluate({
  candidateId: 'forged-simulation-kernel',
  cases: [new EvaluationCase({
    id: 'forged-simulation-case',
    domain: 'simulation',
    task: {
      id: 'forged-simulation-task',
      description: 'Simulate a finite state-machine scenario'
    },
    input: {
      states: ['idle', 'done'],
      initialState: 'idle',
      transitions: [{ from: 'idle', event: 'finish', to: 'done' }],
      events: ['finish']
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
  `FLUID_SIMULATION_EVALUATION_BOUNDARY_OK forgedActionRejected=true `
  + `successRate=${report.successRate} provenRate=${report.provenRate}`
);
