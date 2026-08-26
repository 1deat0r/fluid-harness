import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'simulation-cycle',
    description: 'Simulate a finite state-machine scenario'
  },
  input: {
    states: ['idle', 'running', 'done'],
    initialState: 'idle',
    transitions: [
      { from: 'idle', event: 'start', to: 'running' },
      { from: 'running', event: 'finish', to: 'done' }
    ],
    events: ['start', 'finish']
  },
  reproduction: 'node scripts/check-simulation-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'simulation');
assert.equal(cycle.stages.represent.reasoningEngine, 'simulation-engine');
assert.equal(cycle.stages.act.result.finalState, 'done');
assert.equal(cycle.stages.act.result.completed, true);
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'finite-state-simulation-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_SIMULATION_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `finalState=${cycle.stages.act.result.finalState} evidence=${cycle.stages.verify.evidence} `
  + `verifier=${cycle.stages.verify.verifierId} audit=${cycle.stages.preserve.coreAuditValid}`
);
