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

class CachingGraphPathExecutor extends GraphPathExecutor {
  cachedExecution = null;

  execute(args) {
    this.cachedExecution ??= super.execute(args);
    return this.cachedExecution;
  }
}

const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [new CachingGraphPathExecutor()]
  })
});
const firstPlan = harness.plan({ id: 'execution-reuse-first', description: 'Find a graph path' });
const first = harness.execute({ plan: firstPlan, input: graphInput() });
assert.equal(first.evidence, EVIDENCE_LEVELS.PROVEN);

assert.throws(
  () => harness.execute({ plan: firstPlan, input: graphInput() }),
  /already registered/
);
assert.equal(harness.lastFailureLearningError, null);

console.log('FLUID_EXECUTION_REUSE_OK');
