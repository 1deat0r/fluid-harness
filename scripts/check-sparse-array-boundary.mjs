import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import { ScalingLevel } from '../src/scaling.mjs';
import { WorldModel } from '../src/world-model.mjs';

function sparseValues() {
  const values = [];
  values.length = 4;
  values[1] = 'one';
  return values;
}

function assertSparse(values) {
  assert.equal(values.length, 4);
  assert.equal(values[1], 'one');
  assert.equal(Object.hasOwn(values, '0'), false);
  assert.equal(Object.hasOwn(values, '2'), false);
  assert.equal(Object.hasOwn(values, '3'), false);
  assert.equal(Object.isFrozen(values), true);
}

const model = new WorldModel({ history: [{ values: sparseValues() }] });
assertSparse(model.history[0].values);

const evaluationCase = new EvaluationCase({
  id: 'sparse-array-boundary-case',
  domain: 'snapshot-boundary',
  task: { id: 'sparse-array-boundary-task', description: 'Probe sparse arrays' },
  input: { values: sparseValues() },
  expected: () => true
});
assertSparse(evaluationCase.input.values);

const level = new ScalingLevel({
  id: 'sparse-array-boundary-level',
  computeUnits: 1,
  executionOptions: { values: sparseValues() }
});
assertSparse(level.executionOptions.values);

console.log('FLUID_SPARSE_ARRAY_BOUNDARY_OK');
