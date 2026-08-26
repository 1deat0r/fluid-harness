import assert from 'node:assert/strict';

import {
  ArrayComputationExecutor,
  ConstraintScheduleExecutor,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

function sparseArray(length, entries = {}) {
  const value = [];
  value.length = length;
  for (const [index, entry] of Object.entries(entries)) {
    value[Number(index)] = entry;
  }
  return value;
}

const graphStrategy = {
  representation: REPRESENTATIONS.GRAPH,
  reasoningEngine: REASONING_ENGINES.GRAPH_SEARCH
};
const graphExecutor = new GraphPathExecutor();
assert.throws(
  () => graphExecutor.execute({
    task: { id: 'executor-dense-graph-task' },
    strategy: graphStrategy,
    input: {
      nodes: sparseArray(2, { 1: 'B' }),
      edges: [],
      start: 'B',
      goal: 'B'
    }
  }),
  /holes/i
);

const constraintStrategy = {
  representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
  reasoningEngine: REASONING_ENGINES.CONSTRAINT_SOLVER
};
const constraintExecutor = new ConstraintScheduleExecutor();
assert.throws(
  () => constraintExecutor.execute({
    task: { id: 'executor-dense-constraint-task' },
    strategy: constraintStrategy,
    input: {
      resources: { cpu: 1 },
      jobs: sparseArray(1)
    }
  }),
  /holes/i
);
assert.throws(
  () => constraintExecutor.execute({
    task: { id: 'executor-dense-prerequisite-task' },
    strategy: constraintStrategy,
    input: {
      resources: { cpu: 1 },
      jobs: [{
        id: 'job',
        duration: 1,
        prerequisites: sparseArray(1),
        demand: { cpu: 1 }
      }]
    }
  }),
  /holes/i
);

const arrayStrategy = {
  representation: REPRESENTATIONS.ARRAY_COMPUTATION,
  reasoningEngine: REASONING_ENGINES.ARRAY_COMPUTER
};
const arrayExecutor = new ArrayComputationExecutor();
assert.throws(
  () => arrayExecutor.execute({
    task: { id: 'executor-dense-array-task' },
    strategy: arrayStrategy,
    input: {
      left: sparseArray(2, { 1: 1 }),
      right: sparseArray(2, { 1: 2 }),
      operation: 'add'
    }
  }),
  /holes/i
);

console.log('FLUID_EXECUTOR_DENSE_INPUT_BOUNDARY_OK');
