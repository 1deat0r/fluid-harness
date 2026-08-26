import assert from 'node:assert/strict';

import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

let mutationRejected = false;
class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    try {
      argumentsObject.input.goal = 'A';
    } catch {
      mutationRejected = true;
    }
    return super.execute(argumentsObject);
  }
}

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const execution = new ExecutorRegistry({
  executors: [new MutatingExecutor()]
}).execute({
  task: { id: 'executor-registry-input-isolation-task' },
  strategy: {
    representation: REPRESENTATIONS.GRAPH,
    reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
  },
  input
});

assert.equal(mutationRejected, true);
assert.equal(input.goal, 'B');
assert.equal(Object.isFrozen(input), false);
assert.equal(execution.input.goal, 'B');
assert.deepEqual(execution.result.path, ['A', 'B']);

console.log('FLUID_EXECUTOR_REGISTRY_INPUT_ISOLATION_OK');
