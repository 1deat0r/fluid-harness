import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';

function baseTask() {
  return {
    id: 'evaluation-task-property-boundary-task',
    description: 'Probe evaluation task properties'
  };
}

function hiddenTask() {
  const task = baseTask();
  Object.defineProperty(task, 'hidden', {
    value: 'not visible',
    enumerable: false,
    writable: true,
    configurable: true
  });
  return task;
}

function symbolTask() {
  const task = baseTask();
  task[Symbol('hidden')] = 'not visible';
  return task;
}

function accessorTask() {
  const task = baseTask();
  Object.defineProperty(task, 'dynamic', {
    enumerable: true,
    get() {
      return 'computed';
    }
  });
  return task;
}

for (const makeTask of [hiddenTask, symbolTask, accessorTask]) {
  assert.throws(
    () => new EvaluationCase({
      id: 'evaluation-task-property-boundary-case',
      domain: 'snapshot-boundary',
      task: makeTask(),
      input: {},
      expected: () => true
    }),
    /Evaluation snapshot values must contain only enumerable data properties/
  );
}

console.log('FLUID_EVALUATION_TASK_PROPERTY_BOUNDARY_OK');
