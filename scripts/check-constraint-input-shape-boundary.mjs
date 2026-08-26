import assert from 'node:assert/strict';

import { ConstraintScheduleExecutor } from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

const executor = new ConstraintScheduleExecutor();
const strategy = {
  representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
  reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
};
const task = { id: 'constraint-input-shape-boundary-task' };

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({
    resources: { cpu: 1 },
    jobs: [{ id: 'job', duration: 1, demand: [] }]
  }),
  /plain object|demand/i
);

assert.throws(
  () => execute({
    resources: { cpu: 1 },
    jobs: [{ id: 'job', duration: 1, demand: new Map([['cpu', 1]]) }]
  }),
  /plain object|demand/i
);

const arrayJob = [];
arrayJob.id = 'job';
arrayJob.duration = 1;
arrayJob.demand = { cpu: 1 };
assert.throws(
  () => execute({ resources: { cpu: 1 }, jobs: [arrayJob] }),
  /plain object|job/i
);

const valid = execute({
  resources: { cpu: 1 },
  jobs: [{ id: 'job', duration: 1, demand: {} }]
});
assert.equal(valid.result.schedule[0].demand.cpu, undefined);

console.log('FLUID_CONSTRAINT_INPUT_SHAPE_BOUNDARY_OK');
