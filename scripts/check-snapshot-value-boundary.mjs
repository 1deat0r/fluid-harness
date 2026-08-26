import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import { ScalingLevel } from '../src/scaling.mjs';

function makeCase(input) {
  return {
    id: 'snapshot-value-boundary-case',
    domain: 'snapshot-boundary',
    task: {
      id: 'snapshot-value-boundary-task',
      description: 'Probe snapshot values'
    },
    input,
    expected: () => true
  };
}

assert.throws(
  () => new EvaluationCase(makeCase({ metadata: new Map([['status', 'original']]) })),
  /Evaluation snapshot values must use plain objects and arrays/
);

const marker = function marker() {};
assert.throws(
  () => new EvaluationCase(makeCase({ marker })),
  /Evaluation snapshot values must not contain functions/
);

assert.throws(
  () => new ScalingLevel({
    id: 'snapshot-value-boundary-level',
    computeUnits: 1,
    executionOptions: { metadata: new Set(['original']) }
  }),
  /Scaling snapshot values must use plain objects and arrays/
);

assert.throws(
  () => new ScalingLevel({
    id: 'snapshot-function-boundary-level',
    computeUnits: 1,
    executionOptions: { marker }
  }),
  /Scaling snapshot values must not contain functions/
);

console.log('FLUID_SNAPSHOT_VALUE_BOUNDARY_OK');
