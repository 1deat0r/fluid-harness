import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const cachedExecutions = new WeakMap();
class CachingRegistry extends ExecutorRegistry {
  execute(argumentsObject) {
    let execution = cachedExecutions.get(this);
    if (execution === undefined) {
      execution = super.execute(argumentsObject);
      cachedExecutions.set(this, execution);
    }
    return execution;
  }
}

const harness = new FluidHarness({
  executorRegistry: new CachingRegistry({ executors: [new GraphPathExecutor()] })
});
const firstPlan = harness.plan({ id: 'harness-execution-replay-first', description: 'Find a graph path' });
const first = harness.execute({ plan: firstPlan, input });
assert.equal(first.evidence, EVIDENCE_LEVELS.PROVEN);

const secondPlan = harness.plan({ id: 'harness-execution-replay-second', description: 'Find a graph path' });
assert.throws(
  () => harness.execute({ plan: secondPlan, input }),
  /already-consumed execution/
);
assert.equal(harness.worldModel.history.length, 2);
assert.equal(harness.lastFailureLearningError, null);

const otherHarness = new FluidHarness({ executorRegistry: harness.executorRegistry });
const otherPlan = otherHarness.plan({ id: 'harness-execution-replay-other', description: 'Find a graph path' });
assert.throws(
  () => otherHarness.execute({ plan: otherPlan, input }),
  /consumed by another harness/
);
assert.equal(otherHarness.lastFailureLearningError, null);

console.log('FLUID_HARNESS_EXECUTION_REPLAY_OK');
