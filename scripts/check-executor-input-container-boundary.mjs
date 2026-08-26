import assert from 'node:assert/strict';

import {
  ArrayComputationExecutor,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

const graphInput = [];
graphInput.nodes = ['A'];
graphInput.edges = [];
graphInput.start = 'A';
graphInput.goal = 'A';
assert.throws(
  () => new GraphPathExecutor().execute({
    task: { id: 'executor-input-container-graph-task' },
    strategy: {
      representation: REPRESENTATIONS.GRAPH,
      reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
    },
    input: graphInput
  }),
  /requires nodes and edges|plain object/i
);

const arrayInput = [];
arrayInput.left = [1];
arrayInput.right = [2];
arrayInput.operation = 'add';
assert.throws(
  () => new ArrayComputationExecutor().execute({
    task: { id: 'executor-input-container-array-task' },
    strategy: {
      representation: REPRESENTATIONS.ARRAY_COMPUTATION,
      reasoningEngine: REASONING_ENGINES.ARRAY_COMPUTER
    },
    input: arrayInput
  }),
  /requires left and right|plain object/i
);

console.log('FLUID_EXECUTOR_INPUT_CONTAINER_BOUNDARY_OK');
