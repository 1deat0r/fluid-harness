import assert from 'node:assert/strict';

import { ConstraintScheduleExecutor } from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

const executor = new ConstraintScheduleExecutor();
const strategy = {
  representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
  reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
};
const task = { id: 'constraint-key-normalization-boundary-task' };

assert.throws(
  () => executor.execute({
    task,
    strategy,
    input: {
      resources: { cpu: 1, ' cpu ': 99 },
      jobs: [{
        id: 'job',
        duration: 1,
        prerequisites: [],
        demand: { cpu: 1 }
      }]
    }
  }),
  /duplicate|unique/i
);

assert.throws(
  () => executor.execute({
    task,
    strategy,
    input: {
      resources: { cpu: 1 },
      jobs: [{
        id: 'job',
        duration: 1,
        prerequisites: [],
        demand: { cpu: 1, ' cpu ': 1 }
      }]
    }
  }),
  /duplicate|unique/i
);

console.log('FLUID_CONSTRAINT_KEY_NORMALIZATION_BOUNDARY_OK');
