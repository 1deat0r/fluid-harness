import assert from 'node:assert/strict';

import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

let taskMutationRejected = false;
let strategyMutationRejected = false;
class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    try {
      argumentsObject.task.id = 'mutated-task';
    } catch {
      taskMutationRejected = true;
    }
    try {
      argumentsObject.strategy.reasoningEngine = 'mutated-engine';
    } catch {
      strategyMutationRejected = true;
    }
    return super.execute(argumentsObject);
  }
}

const task = { id: 'original-task' };
const strategy = {
  representation: REPRESENTATIONS.GRAPH,
  reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
};
const execution = new ExecutorRegistry({
  executors: [new MutatingExecutor()]
}).execute({
  task,
  strategy,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

assert.equal(taskMutationRejected, true);
assert.equal(strategyMutationRejected, true);
assert.equal(task.id, 'original-task');
assert.equal(strategy.reasoningEngine, REASONING_ENGINES.GRAPH_ALGORITHMS);
assert.equal(execution.taskId, 'original-task');
assert.equal(execution.reasoningEngine, REASONING_ENGINES.GRAPH_ALGORITHMS);

console.log('FLUID_EXECUTOR_REGISTRY_IDENTITY_ISOLATION_OK');
