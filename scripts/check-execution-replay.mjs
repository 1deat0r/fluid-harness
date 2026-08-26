import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ExecutorRegistry,
  isTrustedExecution
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

function graphInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

const donor = new FluidHarness();
const donorPlan = donor.plan({ id: 'execution-donor', description: 'Find a graph path' });
const donorExecution = donor.executorRegistry.execute({
  task: donorPlan.task,
  strategy: donorPlan.strategy,
  input: graphInput()
});
assert.equal(isTrustedExecution(donorExecution, donor.executorRegistry), true);

const replaying = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [{
      canExecute: () => true,
      execute: () => donorExecution
    }]
  })
});
const replayPlan = replaying.plan({ id: 'execution-replay', description: 'Find a graph path' });

assert.throws(
  () => replaying.execute({ plan: replayPlan, input: graphInput() }),
  /foreign execution/
);
assert.equal(isTrustedExecution(donorExecution, replaying.executorRegistry), false);
assert.equal(replaying.lastFailureLearningError, null);

const valid = new FluidHarness();
const validPlan = valid.plan({ id: 'execution-valid', description: 'Find a graph path' });
const validReport = valid.execute({ plan: validPlan, input: graphInput() });
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_EXECUTION_REPLAY_OK');
