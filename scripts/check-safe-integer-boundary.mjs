import assert from 'node:assert/strict';

import {
  ConstraintScheduleExecutor,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REASONING_ENGINES, REPRESENTATIONS } from '../src/representation.mjs';

const unsafe = Number.MAX_SAFE_INTEGER + 2;
const constraintExecutor = new ConstraintScheduleExecutor();
const constraintStrategy = {
  representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
  reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
};
const task = { id: 'safe-integer-boundary-task' };

function constraintInput(overrides = {}) {
  return {
    resources: { cpu: 1 },
    jobs: [{
      id: 'job-a',
      duration: 1,
      prerequisites: [],
      demand: { cpu: 1 },
      ...overrides
    }]
  };
}

assert.throws(
  () => constraintExecutor.execute({
    task,
    strategy: constraintStrategy,
    input: constraintInput({ duration: unsafe })
  }),
  /safe integer/
);

assert.throws(
  () => constraintExecutor.execute({
    task,
    strategy: constraintStrategy,
    input: {
      resources: { cpu: unsafe },
      jobs: [{ id: 'job-a', duration: 1, prerequisites: [], demand: { cpu: 1 } }]
    }
  }),
  /safe integer/
);

assert.throws(
  () => constraintExecutor.execute({
    task,
    strategy: constraintStrategy,
    input: constraintInput({ demand: { cpu: unsafe } })
  }),
  /safe integer/
);

const graphExecutor = new GraphPathExecutor();
assert.throws(
  () => graphExecutor.execute({
    task,
    strategy: {
      representation: REPRESENTATIONS.GRAPH,
      reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { maxExpansions: unsafe }
  }),
  /safe integer/
);

console.log('FLUID_SAFE_INTEGER_BOUNDARY_OK');
