import assert from 'node:assert/strict';

import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

const executionError = new Error('primary executor failure');
const learningError = new Error('failure learning unavailable');
const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [{
      canExecute: () => true,
      execute: () => {
        throw executionError;
      }
    }]
  })
});
const plan = harness.plan({
  id: 'failure-error-preservation-boundary',
  description: 'Find a graph path'
});
harness.worldModel = {
  measure: () => {
    throw learningError;
  }
};

let thrownError = null;
try {
  harness.execute({ plan, input: {} });
} catch (error) {
  thrownError = error;
}

assert.equal(thrownError, executionError);
assert.equal(harness.lastFailureLearningError, learningError);

console.log('FLUID_FAILURE_ERROR_PRESERVED_OK');
