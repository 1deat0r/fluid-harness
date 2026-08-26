import assert from 'node:assert/strict';

import { ConstraintScheduleExecutor } from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyConstraintExecution } from '../src/verification.mjs';

const executor = new ConstraintScheduleExecutor();
const strategy = {
  representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
  reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
};
const task = { id: 'constraint-time-overflow-boundary-task' };
const duration = Number.MAX_SAFE_INTEGER;

const safeExecution = executor.execute({
  task,
  strategy,
  input: {
    resources: { cpu: 1 },
    jobs: [{
      id: 'single-job',
      duration,
      prerequisites: [],
      demand: { cpu: 1 }
    }]
  }
});
assert.equal(verifyConstraintExecution(safeExecution).passed, true);
assert.equal(Number.isSafeInteger(safeExecution.result.makespan), true);

assert.throws(
  () => executor.execute({
    task,
    strategy,
    input: {
      resources: { cpu: 1 },
      jobs: [
        {
          id: 'first-job',
          duration,
          prerequisites: [],
          demand: { cpu: 1 }
        },
        {
          id: 'second-job',
          duration,
          prerequisites: ['first-job'],
          demand: { cpu: 1 }
        }
      ]
    }
  }),
  /safe integer|overflow/i
);

console.log('FLUID_CONSTRAINT_TIME_OVERFLOW_BOUNDARY_OK');
