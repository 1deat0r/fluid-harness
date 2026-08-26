import assert from 'node:assert/strict';

import {
  createExecutionResult,
  ExecutorRegistry,
  SimulationExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifySimulationExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.SIMULATION,
  reasoningEngine: REASONING_ENGINES.SIMULATION_ENGINE
};
const task = { id: 'simulation-boundary-task' };
const validInput = {
  states: ['idle', 'running', 'done'],
  initialState: 'idle',
  transitions: [
    { from: 'idle', event: 'start', to: 'running' },
    { from: 'running', event: 'finish', to: 'done' }
  ],
  events: ['start', 'finish']
};
const executor = new SimulationExecutor();

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({ ...validInput, initialState: 'missing' }),
  /undeclared/
);
assert.throws(
  () => execute({ ...validInput, states: ['idle', 'idle'], initialState: 'idle' }),
  /unique/
);
assert.throws(
  () => execute({ ...validInput, transitions: [
    ...validInput.transitions,
    { from: 'idle', event: 'start', to: 'done' }
  ] }),
  /Duplicate simulation transition/
);
assert.throws(
  () => execute({ ...validInput, transitions: [
    { from: 'idle', event: 'start', to: 'missing' }
  ] }),
  /undeclared state/
);
assert.throws(
  () => execute({ ...validInput, events: [] }),
  /Simulation events must contain/
);
assert.throws(
  () => execute({
    states: Array.from({ length: 33 }, (_, index) => `s${index}`),
    initialState: 's0',
    transitions: [{ from: 's0', event: 'next', to: 's1' }],
    events: ['next']
  }),
  /1-32 entries/
);

const honest = execute(validInput);
assert.equal(verifySimulationExecution(honest).passed, true);
assert.throws(
  () => verifySimulationExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedSimulationExecutor extends SimulationExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        finalState: 'idle'
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new ForgedSimulationExecutor()] })
});
const forgedPlan = forgedHarness.plan({
  id: 'simulation-forged-result',
  description: 'Simulate a finite state-machine scenario'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: validInput
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, 'PROVEN');

console.log(
  `FLUID_SIMULATION_BOUNDARY_OK malformedRejected=true duplicateRejected=true `
  + `untrustedRejected=true forgedTraceRejected=true evidence=${forgedReport.evidence}`
);
