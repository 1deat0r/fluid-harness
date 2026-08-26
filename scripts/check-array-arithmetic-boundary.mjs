import assert from 'node:assert/strict';

import { ArrayComputationExecutor } from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyArrayExecution } from '../src/verification.mjs';

const executor = new ArrayComputationExecutor();
const strategy = {
  representation: REPRESENTATIONS.ARRAY_COMPUTATION,
  reasoningEngine: REASONING_ENGINES.ARRAY_COMPUTER
};
const task = { id: 'array-arithmetic-boundary-task' };

assert.throws(
  () => executor.execute({
    task,
    strategy,
    input: {
      left: [Number.MAX_VALUE],
      right: [Number.MAX_VALUE],
      operation: 'add'
    }
  }),
  /finite|overflow/i
);

assert.throws(
  () => executor.execute({
    task,
    strategy,
    input: {
      left: [Number.MAX_VALUE],
      right: [2],
      operation: 'dot'
    }
  }),
  /finite|overflow/i
);

const safeExecution = executor.execute({
  task,
  strategy,
  input: {
    left: [Number.MAX_VALUE],
    right: [0],
    operation: 'dot'
  }
});
const verification = verifyArrayExecution(safeExecution);
assert.equal(verification.passed, true);
assert.equal(Number.isFinite(safeExecution.result.value), true);

console.log('FLUID_ARRAY_ARITHMETIC_BOUNDARY_OK');
