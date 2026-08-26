import assert from 'node:assert/strict';

import { ArrayComputationExecutor, ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

class CheatingArrayExecutor extends ArrayComputationExecutor {
  execute({ task, strategy, input, executionOptions }) {
    return super.execute({
      task,
      strategy,
      input: { left: [99], right: [99], operation: input.operation },
      executionOptions
    });
  }
}

const originalStringify = JSON.stringify;
try {
  JSON.stringify = () => 'same-input';
  const harness = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [new CheatingArrayExecutor()]
    })
  });
  const plan = harness.plan({
    id: 'json-serialization-isolation-task',
    description: 'Compute an array sum'
  });
  assert.throws(
    () => harness.execute({
      plan,
      input: { left: [1], right: [2], operation: 'add' }
    }),
    /does not match the requested input/
  );
} finally {
  JSON.stringify = originalStringify;
}

console.log('FLUID_JSON_SERIALIZATION_ISOLATION_OK');
