import assert from 'node:assert/strict';

import {
  ArrayComputationExecutor,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

class HostileArray extends Array {
  map() {
    return [99];
  }
}

const arrayStrategy = {
  representation: REPRESENTATIONS.ARRAY_COMPUTATION,
  reasoningEngine: REASONING_ENGINES.ARRAY_COMPUTER
};
const left = new HostileArray();
left.push(1);
const right = new HostileArray();
right.push(2);
const arrayExecution = new ArrayComputationExecutor().execute({
  task: { id: 'direct-executor-array-method-task' },
  strategy: arrayStrategy,
  input: { left, right, operation: 'add' }
});
assert.deepEqual(arrayExecution.input.left, [1]);
assert.deepEqual(arrayExecution.input.right, [2]);
assert.deepEqual(arrayExecution.result.values, [3]);

const graphNodes = new HostileArray('A', 'B');
const graphExecution = new GraphPathExecutor().execute({
  task: { id: 'direct-executor-graph-method-task' },
  strategy: {
    representation: REPRESENTATIONS.GRAPH,
    reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
  },
  input: {
    nodes: graphNodes,
    edges: [],
    start: 'A',
    goal: 'A'
  }
});
assert.deepEqual(graphExecution.input.nodes, ['A', 'B']);
assert.deepEqual(graphExecution.result.path, ['A']);

const ownMethod = [1];
ownMethod.map = () => [99];
assert.throws(
  () => new ArrayComputationExecutor().execute({
    task: { id: 'direct-executor-own-method-task' },
    strategy: arrayStrategy,
    input: { left: ownMethod, right: [2], operation: 'add' }
  }),
  /function|enumerable data properties/i
);

console.log('FLUID_DIRECT_EXECUTOR_ARRAY_METHOD_BOUNDARY_OK');
