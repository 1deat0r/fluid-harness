import assert from 'node:assert/strict';

import { ConstraintScheduleExecutor } from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyConstraintExecution } from '../src/verification.mjs';

const duration = Number.MAX_SAFE_INTEGER;
const execution = new ConstraintScheduleExecutor().execute({
  task: { id: 'constraint-large-duration-task' },
  strategy: {
    representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
    reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
  },
  input: {
    resources: { cpu: 1 },
    jobs: [{
      id: 'job-a',
      duration,
      prerequisites: [],
      demand: { cpu: 1 }
    }]
  },
  executionOptions: {}
});

const verification = verifyConstraintExecution(execution, {
  reproduction: 'constraint-large-duration-boundary'
});
assert.equal(verification.passed, true);
assert.equal(verification.checks.every(({ passed }) => passed), true);
assert.equal(execution.result.makespan, duration);

console.log('FLUID_CONSTRAINT_LARGE_DURATION_OK');
