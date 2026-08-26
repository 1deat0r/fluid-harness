import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
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

class WrongTaskExecutor extends GraphPathExecutor {
  execute(args) {
    return super.execute({
      ...args,
      task: { ...args.task, id: 'foreign-task-id' }
    });
  }
}

const replaying = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [new WrongTaskExecutor()]
  })
});
const replayPlan = replaying.plan({ id: 'requested-task-id', description: 'Find a graph path' });

assert.throws(
  () => replaying.execute({ plan: replayPlan, input: graphInput() }),
  /requested task or strategy/
);
assert.equal(replaying.lastFailureLearningError, null);

const valid = new FluidHarness();
const validPlan = valid.plan({ id: 'identity-valid', description: 'Find a graph path' });
const validReport = valid.execute({ plan: validPlan, input: graphInput() });
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_EXECUTION_IDENTITY_OK');
