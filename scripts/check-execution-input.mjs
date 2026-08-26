import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

function requestedInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

class WrongInputExecutor extends GraphPathExecutor {
  execute(args) {
    return super.execute({
      ...args,
      input: {
        nodes: ['A', 'B', 'C'],
        edges: [['A', 'B'], ['B', 'C']],
        start: 'A',
        goal: 'C'
      }
    });
  }
}

const replaying = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [new WrongInputExecutor()]
  })
});
const replayPlan = replaying.plan({ id: 'input-replay', description: 'Find a graph path' });

assert.throws(
  () => replaying.execute({ plan: replayPlan, input: requestedInput() }),
  /requested input/
);
assert.equal(replaying.lastFailureLearningError, null);

const valid = new FluidHarness();
const validPlan = valid.plan({ id: 'input-valid', description: 'Find a graph path' });
const validReport = valid.execute({ plan: validPlan, input: requestedInput() });
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_EXECUTION_INPUT_OK');
